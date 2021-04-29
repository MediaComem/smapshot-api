/* eslint-disable node/no-unpublished-require */
const chalk = require('chalk');
const { mkdirs, writeFile } = require('fs-extra');
const glob = require('glob');
const path = require('path');

const config = require('../config/precompile'); // Use precompile configuration.
const logger = require('../config/logger');
const { loadJsonFile } = require('./utils/json');

const apiDir = path.join(config.root, 'app', 'api');
const assembledApiSchemaFile = path.join(config.generatedDir, 'schemas.json');

// Load, assemble and save all JSON schemas into a single file.
Promise
  .resolve()
  .then(loadSchemas)
  .then(saveAssembledSchemas)
  .catch(err => {
    console.error(chalk.red(err.stack));
    process.exit(1)
  });

/**
 * Reads, parses and returns all the schemas defined in an array.
 */
function loadSchemas() {

  // Find all JSON schemas.
  const includedFiles = glob.sync('./**/*.schema.json', { cwd: apiDir });
  if (!includedFiles.length) {
    throw new Error(`No schemas found in directory ${JSON.stringify(apiDir)}`);
  }

  // Read all the matching files.
  const absolutePaths = includedFiles.map(relativePath => path.join(apiDir, relativePath));
  const schemaFilesById = {};
  return absolutePaths.map(absolutePath => {

    const schema = loadJsonFile(absolutePath)

    // Make sure all JSON schemas have an ID.
    const schemaId = schema.$id;
    if (!schemaId) {
      throw new Error(`JSON schema in ${absolutePath} is missing an $id property`);
    }

    // Make sure all IDs are unique.
    const existingDeclaration = schemaFilesById[schemaId];
    if (existingDeclaration) {
      throw new Error(`JSON schema ID ${schema.$id} in file ${absolutePath} was already defined in file ${existingDeclaration}`);
    }

    return schema;
  });
}

/**
 * Saves assembled JSON schemas to the generated directory.
 */
async function saveAssembledSchemas(schemas) {
  await mkdirs(path.dirname(assembledApiSchemaFile));
  await writeFile(assembledApiSchemaFile, JSON.stringify(schemas, undefined, 2), 'utf8');

  const sourceDescription = path.join(path.relative(config.root, apiDir), '**', '*.schema.json');
  const targetDescription = path.relative(config.root, assembledApiSchemaFile);
  logger.debug(`All JSON schemas matching ${chalk.yellow(sourceDescription)} assembled and saved to ${chalk.green(targetDescription)}`);
}
