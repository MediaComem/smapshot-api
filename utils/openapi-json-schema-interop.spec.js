const { expect } = require('../spec/utils/chai');
const { convertJsonSchemaToOpenApi, convertOpenApiSchemaToJsonSchema } = require('./openapi-json-schema-interop');

describe('OpenAPI utilities', () => {
  it('removes the $id and $schema properties from a JSON schema', () => {
    const converted = convertJsonSchemaToOpenApi({
      $id: 'Example',
      $schema: 'http://json-schema.org/draft-07/schema',
      type: 'string'
    });

    expect(converted).to.deep.equal({
      type: 'string'
    });
  });

  it('converts JSON schema $ref properties to OpenAPI component references', () => {
    const converted = convertJsonSchemaToOpenApi({
      type: 'object',
      properties: {
        lang: {
          $ref: 'LanguageParameter#'
        }
      }
    });

    expect(converted).to.deep.equal({
      type: 'object',
      properties: {
        lang: {
          $ref: '#/components/schemas/LanguageParameter'
        }
      }
    });
  });

  it('converts a JSON schema with a type array containing null to an OpenAPI schema with the nullable property', () => {
    const converted = convertJsonSchemaToOpenApi({
      type: [ 'string', 'null' ]
    });

    expect(converted).to.deep.equal({
      type: 'string',
      nullable: true
    });
  });

  it('converts a JSON schema with a multi-type array containing null to an OpenAPI schema with the nullable property', () => {
    const converted = convertJsonSchemaToOpenApi({
      type: [ 'string', 'number', 'null' ]
    });

    expect(converted).to.deep.equal({
      type: [ 'string', 'number' ],
      nullable: true
    });
  });

  it('converts a JSON schema with a "oneOf" property containing a null type to an OpenAPI schema with the nullable property', () => {
    const converted = convertJsonSchemaToOpenApi({
      oneOf: [
        { type: 'string' },
        { type: 'null' }
      ]
    });

    expect(converted).to.deep.equal({
      type: 'string',
      nullable: true
    });
  });

  it('converts a JSON schema with a "oneOf" property containing a null type and multiple other types to an OpenAPI schema with the nullable property', () => {
    const converted = convertJsonSchemaToOpenApi({
      oneOf: [
        { type: 'string' },
        { type: 'number' },
        { type: 'null' }
      ]
    });

    expect(converted).to.deep.equal({
      nullable: true,
      oneOf: [
        { type: 'string' },
        { type: 'number' }
      ]
    });
  });

  it('converts a JSON schema "oneOf" property containing complex types and a null type to using the OpenAPI nullable property', () => {
    const converted = convertJsonSchemaToOpenApi({
      oneOf: [
        {
          type: 'string',
          minLength: 2
        },
        {
          type: 'null'
        }
      ]
    });

    expect(converted).to.deep.equal({
      type: 'string',
      minLength: 2,
      nullable: true
    });
  });

  it('refuses to convert a JSON schema if the top-level object and single non-null sub-type share keys', () => {
    expect(() => convertJsonSchemaToOpenApi({
      description: 'This is the top level',
      oneOf: [
        {
          type: 'string',
          minLength: 2,
          description: 'This is one of the variants'
        },
        {
          type: 'null'
        }
      ]
    })).to.throw(/cannot be converted/i);
  });

  it('converts a single-type nullable OpenAPI schema to a JSON schema with a null type', () => {
    const converted = convertOpenApiSchemaToJsonSchema({
      type: 'string',
      nullable: true
    });

    expect(converted).to.deep.equal({
      type: [ 'string', 'null' ]
    });
  });

  it('converts a nullable OpenAPI schema with a multi-type array to a JSON schema with a null type', () => {
    const converted = convertOpenApiSchemaToJsonSchema({
      type: [ 'string', 'number' ],
      nullable: true
    });

    expect(converted).to.deep.equal({
      type: [ 'string', 'number', 'null' ]
    });
  });

  it('converts a nullable OpenAPI schema with a "oneOf" property to a JSON schema with an additional null type', () => {
    const converted = convertOpenApiSchemaToJsonSchema({
      nullable: true,
      oneOf: [
        {
          type: 'string',
          minLength: 2
        },
        {
          type: 'number'
        }
      ]
    });

    expect(converted).to.deep.equal({
      oneOf: [
        {
          type: 'string',
          minLength: 2
        },
        {
          type: 'number'
        },
        {
          type: 'null'
        }
      ]
    });
  });

  it('refuses to convert a nullable OpenAPI schema with a "oneOf" property mixed with other properties at the top level', () => {
    expect(() => convertOpenApiSchemaToJsonSchema({
      type: 'number',
      nullable: true,
      oneOf: [
        { multipleOf: 3 },
        { multipleOf: 4 }
      ]
    })).to.throw(/cannot be converted/i);
  });

  it('refuses to convert an OpenAPI schema containing a reference', () => {
    expect(() => convertOpenApiSchemaToJsonSchema({
      type: 'object',
      properties: {
        lang: {
          $ref: '#/components/schemas/LanguageParameter'
        }
      }
    })).to.throw(/not supported/i);
  });

  describe('integration', () => {
    it('converts a JSON schema into an OpenAPI schema', () => {
      const converted = convertJsonSchemaToOpenApi({
        $id: 'NullablePerson',
        $schema: 'http://json-schema.org/draft-07/schema',
        oneOf: [
          {
            type: 'object',
            properties: {
              firstName: {
                type: 'string'
              },
              middleName: {
                type: [ 'string', 'null' ]
              },
              lastName: {
                type: 'string'
              },
              age: {
                $ref: 'Age#'
              }
            }
          },
          {
            type: 'null'
          }
        ]
      });

      expect(converted).to.deep.equal({
        type: 'object',
        nullable: true,
        properties: {
          firstName: {
            type: 'string'
          },
          middleName: {
            type: 'string',
            nullable: true
          },
          lastName: {
            type: 'string'
          },
          age: {
            $ref: '#/components/schemas/Age'
          }
        }
      });
    });

    it('converts an OpenAPI schema into a JSON schema', () => {
      const converted = convertOpenApiSchemaToJsonSchema({
        type: 'object',
        nullable: true,
        properties: {
          firstName: {
            type: 'string'
          },
          middleName: {
            type: 'string',
            nullable: true
          },
          lastName: {
            type: 'string'
          }
        }
      });

      expect(converted).to.deep.equal({
        oneOf: [
          {
            type: 'object',
            properties: {
              firstName: {
                type: 'string'
              },
              middleName: {
                type: [ 'string', 'null' ]
              },
              lastName: {
                type: 'string'
              }
            }
          },
          {
            type: 'null'
          }
        ]
      });
    });
  });
});
