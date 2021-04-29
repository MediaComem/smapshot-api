/* eslint-disable node/no-unpublished-require */
const swaggerParser = require('@apidevtools/swagger-parser');
const chalk = require('chalk');
const { existsSync, mkdirs, writeFile } = require('fs-extra');
const glob = require('glob');
const yaml = require('js-yaml');
const { isArray, isFunction, isPlainObject, isString, last } = require('lodash');
const path = require('path');

const config = require('../config/precompile'); // Use precompile configuration.
const logger = require('../config/logger');
const { loadJsonFile, read } = require('./utils/json');
const { convertJsonSchemaToOpenApi } = require('../utils/openapi-json-schema-interop');

const jsonFileRegExp = /^.+\.json$/;
const jsFileRegExp = /^.+\.js$/;
const yamlFileRegExp = /^.+\.ya?ml$/;
const supportedIncludeTypes = [ 'jsonSchemasById', 'openApi' ];

const apiDir = path.join(config.root, 'app', 'api');
const baseOpenApiFile = path.join(apiDir, 'openapi.yml');
const assembledOpenApiFile = path.join(config.generatedDir, 'openapi.json');
const dereferencedOpenApiFile = path.join(config.generatedDir, 'openapi.dereferenced.json');

// Assemble and save the OpenAPI document, and also save a dereferenced version
// for programmatic use.
Promise
  .resolve()
  .then(assembleOpenApiDocument)
  .then(openApiDocument => Promise.all([
    saveAssembledOpenApiDocument(openApiDocument),
    saveDereferencedOpenApiDocument(openApiDocument)
  ]))
  .catch(err => {
    console.error(chalk.red(err.stack));
    process.exit(1)
  });

/**
 * Reads the base OpenAPI document, resolving all includes and merges.
 */
function assembleOpenApiDocument() {
  return loadFile(baseOpenApiFile);
}

/**
 * Creates a custom swagger resolver that will look for JSON schema references
 * in this API's OpenAPI document instead of fetching them from the file system
 * or downloading them.
 *
 *     {
 *       "type": "array",
 *       "items": {
 *          "$ref": "SomeSchema#/some/pointer"
 *       }
 *     }
 *
 * A schema may be referenced by its `$id` property, e.g. `SomeSchema#` refers
 * to the documented schema with an `$id` property equal to `SomeSchema`. The
 * content after the hash is a JSON pointer to which portion of the referenced
 * document is included, in this case an empty string which is the JSON pointer
 * for the root of the document (https://tools.ietf.org/html/rfc6901#section-5).
 *
 * See https://apitools.dev/swagger-parser/docs/options.html and
 * https://apitools.dev/json-schema-ref-parser/docs/plugins/resolvers.html.
 */
function createLocalJsonSchemaResolver(openApiDocument) {
  return {
    order: 1,
    canRead: /^./i,
    read(file, callback, _$refs) {
      if (!file || !isString(file.url)) {
        return callback(new Error(`Unsupported swagger parser schema reference ${JSON.stringify(file)}`));
      }

      // By default, a reference to `SomeSchema` will look like
      // `/path/to/project/SomeSchema` as it attempts to load it from the file
      // system. Assume the last segment of that path is the schema's `$id`.
      const name = file.url.replace(/^.*[/\\]/, '').replace(/\$/, '');
      const resolved = openApiDocument.components.schemas[name];
      if (!resolved) {
        return callback(new Error(`Schema ${name} not found in the OpenAPI document`));
      }

      callback(undefined, resolved);
    }
  };
}

/**
 * Creates a YAML schema which supports including other JSON or YAML files with
 * the `!include` tag.
 *
 * @param {string} file - The YAML file to parse, used to resolve relative
 * include paths.
 * @param {string[]} [includePath=[]] - Parent files if this file was included
 * from another file.
 */
function createYamlIncludeSchema(file, includePath = []) {

  const yamlIncludeTag = new yaml.Type('!include', {
    // Only scalars (YAML strings) can be passed to this tag. Other available
    // types are "sequence" (array) and "mapping" (object). See
    // http://www.yaml.org/spec/1.2/spec.html#kind//.
    kind: 'scalar',

    // Check if the input object is suitable for this tag.
    resolve: function(data) {
      return typeof data === 'string';
    },

    // Include the specified file or files when this tag is found.
    construct: function(include) {
      const { type: includeType, target: pathOrPattern } = parseInclude(include);
      return includeFileOrFiles(pathOrPattern, file, includeType, includePath);
    }
  });

  return new yaml.Schema.create([ yamlIncludeTag ]);
}

/**
 * Reads, parses and returns the specified file or files.
 *
 * @param {string} pathOrPattern - The path of pattern indicating one or several
 * files to include.
 * @param {("openApi"|"jsonSchemasById")} includeType - The type of include,
 * which will influence how the contents of the files are processed.
 * @param {string} fromFile - The parent file from which to resolve relative
 * paths.
 * @param {string[]} [includePath=[]] - Parent files.
 */
function includeFileOrFiles(pathOrPattern, fromFile, includeType, includePath = []) {

  const directory = path.dirname(fromFile);

  // If the exact (relative or absolute) path to a single file is provided,
  // include that file.
  const absolutePath = path.resolve(directory, pathOrPattern);
  if (existsSync(absolutePath)) {
    return loadFile(absolutePath, includeType, includePath);
  }

  // Otherwise, treat the included value as a glob pattern and attempt to find
  // matching files.
  const includedFiles = glob.sync(pathOrPattern, { cwd: directory });
  if (!includedFiles.length) {
    throw new Error(`No file matches the path or pattern ${JSON.stringify(pathOrPattern)} from directory ${JSON.stringify(directory)}`);
  }

  // Read all the matching files and merge their contents together.
  const absolutePaths = includedFiles.map(relativePath => path.join(directory, relativePath));
  const merged = absolutePaths.reduce(
    ({ into, previousFile }, absolutePath) => {
      const contents = loadFile(absolutePath, includeType, includePath);
      return {
        into: mergeIncludedFile(contents, into, absolutePath, previousFile),
        previousFile: absolutePath
      };
    },
    { into: undefined, previousFile: undefined }
  );

  return merged.into;
}

/**
 * Loads a file containing an OpenAPI document fragment.
 *
 * @param {string} file - The path to the file to load.
 * @param {("openApi"|"jsonSchemasById")} includeType - The type of include,
 * which will influence how the contents of the file are processed.
 * @param {string[]} [includePath=[]] - Parent files if this file was included
 * from another file.
 */
function loadFile(file, includeType, includePath = []) {

  let loadedContents;
  if (jsonFileRegExp.exec(file)) {
    loadedContents = loadJsonFile(file, includePath);
  } else if (jsFileRegExp.exec(file)) {
    loadedContents = loadJavaScriptFile(file, includePath);
  } else if (yamlFileRegExp.exec(file)) {
    loadedContents = loadYamlFile(file, includePath);
  } else {
    throw new Error(`Unsupported file type in include ${JSON.stringify(file)}`);
  }

  return processIncludedContents(loadedContents, file, includeType);
}

/**
 * Loads an OpenAPI document fragment from a JavaScript file. The file is
 * expected to export a valid JSON value (e.g. array, object, string, etc). It
 * must not return a Promise.
 *
 * @param {string} file - The path to the file to load.
 * @param {("openApi"|"jsonSchemasById")} includeType - The type of include,
 * which will influence how the contents of the file are processed.
 * @param {string[]} [includePath=[]] - Parent files if this file was included
 * from another file.
 */
function loadJavaScriptFile(file, includePath = []) {

  const contents = require(file);
  if (!contents) {
    throw new Error(`File ${file}${includePath ? ` included from ${last(includePath)}` : ''} exports a falsy value`);
  } else if (isFunction(contents.then)) {
    throw new Error(`File ${file}${includePath ? ` included from ${last(includePath)}` : ''} exports a promise, which is not supported at this time`);
  }

  return contents;
}

/**
 * Loads an OpenAPI document fragment from a YAML file.
 *
 * @param {string} file - The path to the file to load.
 * @param {("openApi"|"jsonSchemasById")} includeType - The type of include,
 * which will influence how the contents of the file are processed.
 * @param {string[]} [includePath=[]] - Parent files if this file was included
 * from another file.
 */
function loadYamlFile(file, includePath = []) {
  const contents = read(file, includePath);
  const schema = createYamlIncludeSchema(file, [ ...includePath, file ]);
  return yaml.safeLoad(contents, { schema });
}

/**
 * Merges OpenAPI document fragments together. All merged fragments must be of
 * the same type (array or object). This function is meant to be called
 * sequentially on each fragment to merge, with the result of the previous merge
 * as an argument.
 *
 * @param {string} contents - The contents read from the included file.
 * @param {(Array|Object)} into - The result of merging the previously included
 * files.
 * @param {string} file - The path to the included file.
 * @param {string} previousFile - The path to the previous merged file.
 * @returns {(Array|Object)} The result of merging the specified contents.
 */
function mergeIncludedFile(contents, into, file, previousFile) {
  if (into === undefined) {
    return contents;
  } else if (isArray(into) && isArray(contents)) {
    return [ ...into, ...contents ];
  } else if (isPlainObject(into) && isPlainObject(contents)) {
    return { ...into, ...contents };
  } else {
    throw new Error(`File ${file} cannot be merged into ${previousFile} because they are not both arrays or objects or their types differ`);
  }
}

/**
 * Parses the value of a YAML `!include!` tag.
 *
 * @param {string} include - The value to parse.
 * @returns {YamlInclude} The parsed value.
 */
function parseInclude(include) {

  const parts = include.trim().split(/\s+/, 2);
  if (parts.length === 1) {
    return {
      type: 'openApi',
      target: parts[0]
    };
  } else if (!supportedIncludeTypes.includes(parts[0])) {
    throw new Error(`YAML include tag ${JSON.stringify(`!include ${include}`)} uses unsupported type ${JSON.stringify(parts[0])}; only the following types are supported: ${supportedIncludeTypes.join(', ')}`);
  }

  return {
    type: parts[0],
    target: parts[1]
  };
}

/**
 * Saves the OpenAPI document to the generated directory.
 */
async function saveAssembledOpenApiDocument(openApiDocument) {
  await mkdirs(path.dirname(assembledOpenApiFile));
  await writeFile(assembledOpenApiFile, JSON.stringify(openApiDocument, undefined, 2), 'utf8');

  const sourceDescription = path.relative(config.root, baseOpenApiFile);
  const targetDescription = path.relative(config.root, assembledOpenApiFile);
  logger.debug(`OpenAPI document assembled from ${chalk.yellow(sourceDescription)} and saved to ${chalk.green(targetDescription)}`);
}

/**
 * Dereferences the OpenAPI document and saves it to the generated directory.
 *
 * Dereferencing is the process of replacing all `$ref` pointers in the document
 * with the resolved value. This makes it much simpler to use for programmatic
 * usage. See
 * https://apitools.dev/swagger-parser/docs/swagger-parser.html#dereferenceapi-options-callback.
 */
async function saveDereferencedOpenApiDocument(openApiDocument) {

  const dereferencedOpenApiDocument = await swaggerParser.dereference(
    openApiDocument,
    {
      resolve: {
        localJsonSchemaResolver: createLocalJsonSchemaResolver(openApiDocument)
      }
    }
  );

  await mkdirs(path.dirname(dereferencedOpenApiFile));
  await writeFile(dereferencedOpenApiFile, JSON.stringify(dereferencedOpenApiDocument, undefined, 2), 'utf8');

  const targetDescription = path.relative(config.root, dereferencedOpenApiFile);
  logger.debug(`OpenAPI document dereferenced and saved to ${chalk.green(targetDescription)}`);
}

/**
 * Processes an OpenAPI document fragment read from an included file.
 *
 * * If the type is "openApi" (the default), the contents are returned
 *   unchanged.
 * * If the type is "jsonSchemasById", the contents are assumed to be a JSON
 *   schema with an "$id" property. An object is returned with one key: the ID
 *   of the JSON schema. The value of that key is the schema itself.
 *
 *   For example, this schema:
 *
 *       {
 *         "$id": "FooBar",
 *         "type": "string"
 *       }
 *
 *   Will be returned as:
 *
 *       {
 *         "FooBar": {
 *           "$id": "FooBar",
 *           "type": "string"
 *         }
 *       }
 *
 *   This allows multiple JSON schemas to be merged into the
 *   `/components/schema` property of an OpenAPI document.
 *
 * @param {object} contents - The contents read from the included file.
 * @param {string} file - The path to the file that was loaded.
 * @param {("openApi"|"jsonSchemasById")} includeType - The type of include,
 * which will influence how the contents are processed.
 */
function processIncludedContents(contents, file, includeType) {
  if (includeType === 'jsonSchemasById') {
    if (!contents.$id) {
      throw new Error(`File ${file} is being loaded as a JSON schema and must have an "$id" property which will identify it in the OpenAPI document`);
    }
    return {
      [contents.$id]: convertJsonSchemaToOpenApi(contents)
    };
  } else if (includeType === undefined || includeType === 'openApi') {
    return contents;
  } else {
    throw new Error(`Unsupported type ${JSON.stringify(includeType)} for file ${JSON.stringify(file)}`);
  }
}

/**
 * A parsed YAML `!include` tag.
 *
 * @typedef {Object} YamlInclude
 * @property {("openApi"|"jsonSchemasById")} type - The type of include, which
 * will influence how the contents of the files are processed.
 * @property {string} target - A relative or absolute path to a single file to
 * include, or a glob pattern that matches one or several files to include.
 */
