const { flow, intersection, isArray, isEqual, isPlainObject, mapValues, omit, reject, without } = require('lodash');

/*
 * This file contains utilities to work with JSON schemas and OpenAPI-compliant
 * schemas. It is used both by scripts in the "commands" directory, and by test
 * code in the "spec" directory, which is why it is in the top-level "utils"
 * directory.
 */

/**
 * Converts a JSON schema into an OpenAPI schema. This is necessary because the
 * two specifications are not exactly the same.
 *
 * The "$id" and "$schema" properties are removed as they are not supported by
 * the specification.
 *
 * The "null" type is replaced by the "nullable" property. At the time of
 * writing, "null" is not a supported type in the OpenAPI specification. See
 * https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#data-types.
 *
 * "$ref" pointers are updated to component references, assuming all JSON
 * schemas are found under the OpenAPI document's "/components/schemas"
 * property. This allows JSON schemas written with relative "$ref" pointers to
 * be included into an OpenAPI document.
 *
 * See the tests in the companion `.spec.js` file for conversion examples.
 *
 * @param {*} schema - The schema to convert, or a portion of it.
 * @returns {*} The schema with updated $ref pointers.
 */
exports.convertJsonSchemaToOpenApi = convertJsonSchemaToOpenApi;

/**
 * Converts an OpenAPI schema into a JSON schema. This is necessary because the
 * two specifications are not exactly the same.
 *
 * The "nullable" property is replaced by a "null" type.
 *
 * Note that the conversion of OpenAPI component references back to JSON schema
 * references is not supported. It is assumed that this conversion function will
 * only be used on full schemas from a dereferenced OpenAPI document (which
 * would not contain any references).
 *
 * See the tests in the companion `.spec.js` file for conversion examples.
 */
exports.convertOpenApiSchemaToJsonSchema = convertOpenApiSchemaToJsonSchema;

function convertJsonSchemaToOpenApi(schema) {
  if (isPlainObject(schema)) {
    const convertedSchema = flow(
      convertJsonSchemaRefsToOpenApi,
      convertNullableJsonSchemaToOpenApi,
      removeJsonSchemaMetadataForOpenApi
    )(schema);

    // Recursively convert the values of a schema object.
    return mapValues(convertedSchema, convertJsonSchemaToOpenApi);
  } else if (isArray(schema)) {
    // Recursively convert arrays.
    return schema.map(convertJsonSchemaToOpenApi);
  } else {
    // If the argument is any other type of JSON value, return it unchanged.
    return schema;
  }
}

function convertJsonSchemaRefsToOpenApi(schema) {
  if (schema.$ref) {
    return {
      ...schema,
      // Replace relative references by OpenAPI component references.
      $ref: schema.$ref.replace(/^(.*)#/, '#/components/schemas/$1')
    };
  }

  return schema;
}

function convertNullableJsonSchemaToOpenApi(schema) {
  const { oneOf, type, ...rest } = schema;
  if (isArray(oneOf) && oneOf.length >= 2 && oneOf.some(isNullJsonSchema)) {
    const oneOfWithoutNull = reject(oneOf, isNullJsonSchema);
    const [ firstSubschema, ...extraSubschemas ] = oneOfWithoutNull;
    if (extraSubschemas.length === 0) {

      // If the schema has a "oneOf" array with two types, one of which is the
      // null type, merge the top-level schema and the remaining subschema
      // together and add the "nullable" property.
      //
      // Unless there are keys in common between the top-level schema and the
      // remaining subschema. In that case, conversion is too complex and not
      // supported.
      const keysInCommon = intersection(Object.keys(schema), Object.keys(firstSubschema));
      if (keysInCommon.length) {
        throw new Error(`JSON schema ${JSON.stringify(schema)} cannot be converted into an OpenAPI schema because the top-level object has keys in common with its ${JSON.stringify(firstSubschema)} sub-type`);
      }

      return {
        ...rest,
        ...firstSubschema,
        nullable: true
      };
    } else {
      // If the schema has a "oneOf" array with more than two types, one of
      // which is the null type, remove the null type and add the "nullable"
      // property instead.
      return {
        ...schema,
        nullable: true,
        oneOf: oneOfWithoutNull
      }
    }
  } else if (isArray(type) && type.includes('null')) {
    // If the schema contains "null" in its type array, remove it and use the
    // "nullable" property instead.
    const typesWithoutNull = without(type, 'null');
    return {
      ...schema,
      type: typesWithoutNull.length === 1 ? typesWithoutNull[0] : typesWithoutNull,
      nullable: true
    };
  }

  return schema;
}

function removeJsonSchemaMetadataForOpenApi({ $id: _ignoredId, $schema: _ignoredSchema, ...schemaDefinition }) {
  return schemaDefinition;
}

function convertOpenApiSchemaToJsonSchema(schema) {
  if (isPlainObject(schema)) {
    const convertedSchema = convertNullableOpenApiSchemaToJsonSchema(schema);
    // Recursively convert the values of a schema object.
    return mapValues(convertedSchema, convertOpenApiSchemaToJsonSchema);
  } else if (isArray(schema)) {
    // Recursively convert arrays.
    return schema.map(convertOpenApiSchemaToJsonSchema);
  } else {
    // If the argument is any other type of JSON value, return it unchanged.
    return schema;
  }
}

function convertNullableOpenApiSchemaToJsonSchema(schema) {
  if (schema.$ref) {
    throw new Error(`Converting OpenAPI references to JSON schema references is not supported`);
  }

  const { nullable, oneOf, type, ...rest } = schema;
  const noOtherProperties = Object.keys(rest).length === 0;
  if (nullable === true && type === undefined && isArray(oneOf) && noOtherProperties) {
    // If the schema has a "oneOf" array with no type and no other properties,
    // simply append a null type.
    return {
      ...rest,
      oneOf: [ ...oneOf, { type: 'null' } ]
    }
  } else if (nullable === true && type !== undefined && oneOf === undefined && noOtherProperties) {
    // If the schema is a nullable type and has no other properties, simply add
    // null to its list of types.
    return {
      type: [ ...toArray(type), 'null' ]
    };
  } else if (nullable === true && type !== undefined && oneOf === undefined) {
    // If the schema is a nullable type with no "oneOf" array but with other
    // extra properties, convert it to a schema with a "oneOf" array containing
    // an extra null type.
    return {
      oneOf: [
        { type, ...rest },
        { type: 'null' }
      ]
    };
  } else if (nullable === true) {
    // Do not accept more complex schema for now.
    throw new Error(`OpenAPI schema ${JSON.stringify(schema)} cannot be converted to a JSON schema`);
  }

  return schema;
}

function isNullJsonSchema(schema) {
  return isEqual(
    omit(schema, [ '$id', '$schema' ]),
    { type: 'null' }
  );
}

function toArray(value) {
  return isArray(value) ? value : [ value ];
}
