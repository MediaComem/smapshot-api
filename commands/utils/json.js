/* eslint-disable node/no-unpublished-require */
const { readFileSync } = require('fs');
const jsonPointer = require('json-pointer');
const { isArray, isPlainObject, last, mapValues, merge } = require('lodash');
const path = require('path');

exports.loadJsonFile = loadJsonFile;
exports.read = read;

/**
 * Dereferences JSON data, resolving "$$merge" instructions to include other
 * JSON files.
 *
 * @param {*} value - The parsed JSON to dereference.
 * @param {string} fromFile - The file in which the "$$merge" property was
 * found.
 * @param {string[]} [includePath=[]] - Parent files if this file was included
 * from another file.
 * @returns {Object} Dereferenced JSON data.
 */
function dereferenceJson(value, fromFile, includePath = []) {
  if (isArray(value)) {
    // Recursively dereference array values.
    return value.map(dereferenceJson);
  } else if (isPlainObject(value)) {

    const { $$merge, ...rest } = value;

    // Recursively dereference object property values.
    const base = mapValues(rest, propertyValue => dereferenceJson(propertyValue, fromFile, includePath));

    // Pass through an object with no "$$merge" property.
    if (!$$merge) {
      return base;
    }

    const { file, pointer } = $$merge;

    // If the object has a property "$$merge", load the contents from the
    // included file.
    const absolutePath = path.resolve(path.dirname(fromFile), file);
    let contents = loadJsonFile(absolutePath, [ ...includePath, fromFile ]);

    // Extract the relevant portion of the contents if a JSON pointer was
    // specified.
    if (pointer) {
      if (!jsonPointer.has(contents, pointer)) {
        throw new Error(`Cannot merge content into ${fromFile} because no value was found at ${pointer} in ${file}`);
      }

      contents = jsonPointer.get(contents, pointer);
    }

    // Make sure the included data is an object.
    if (!isPlainObject(contents)) {
      throw new Error(`Cannot merge content from file ${file}${pointer ? ` at ${pointer}` : ''} into ${fromFile} because that value is not an object`);
    }

    // Merge it into the parent object.
    return merge(base, contents);
  } else {
    return value;
  }
}

/**
 * Loads a JSON file for this API, resolving "$$merge" instructions to include
 * other JSON files.
 *
 * @param {string} file - The path to the file to load.
 */
function loadJsonFile(file, includePath = []) {
  const contents = read(file, includePath);
  const parsedJson = JSON.parse(contents);
  const dereferencedJson = dereferenceJson(parsedJson, file, includePath);
  return dereferencedJson;
}

/**
 * Reads a UTF-8 encoded text file synchronously.
 *
 * @param {string} file - The file to read.
 * @param {string[]} [includePath=[]] - Parent files if this file was included
 * from another file.
 * @returns {string} The contents of the file.
 */
function read(file, includePath = []) {
  if (includePath.includes(file)) {
    throw new Error(`Could not include file ${file} from ${last(includePath)} because it would form an infinite loop: ${includePath.join(' -> ')} -> ${file}`);
  }

  try {
    return readFileSync(file, 'utf8');
  } catch (err) {
    throw new Error(`Could not read file ${file}${includePath.length ? ` included from ${last(includePath)}` : ''} because: ${err.message}`);
  }
}
