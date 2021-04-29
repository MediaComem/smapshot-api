/**
 * Builds a validation error object as returned by the API when a property
 * required to be an email by a JSON schema is not a valid email.
 *
 *     emailFormatError();
 *     // { location: 'body', path: '/email', message: 'should match format "email"', validation: 'format' }
 */
exports.emailFormatError = (options = {}) => {
  const property = options.property || 'email';
  return {
    location: options.location || 'body',
    path: options.path || `/${property}`,
    message: options.message || 'should match format "email"',
    validation: options.validation || 'format'
  };
};

/**
 * Builds a validation error object as returned by the API when a property
 * required to be a date by a JSON schema is not a valid date.
 *
 *     dateFormatError();
 *     // { location: 'body', path: '/date', message: 'should match format "date"', validation: 'format' }
 */
exports.dateFormatError = (options = {}) => {
  const property = options.property || 'email';
  return {
    location: options.location || 'body',
    path: options.path || `/${property}`,
    message: options.message || 'should match format "date"',
    validation: options.validation || 'format'
  };
};

/**
 * Builds a validation error object as returned by the API when a property does
 * not match the enumeration required by a JSON schema.
 *
 *     enumError({ property: 'foo', allowedValues: [ 'bar', 'baz' ] });
 *     // { location: 'body', path: '/foo', message: "should be equal to one of the allowed values", validation: 'enum' }
 */
exports.enumError = (options = {}) => {
  const property = options.property;
  return {
    location: options.location || 'body',
    path: options.path || `/${property}`,
    message: 'should be equal to one of the allowed values',
    validation: 'enum'
  };
};

/**
 * Builds a validation error object as returned by the API when a string is
 * shorter than the minimum length required by a JSON schema.
 *
 *     minLengthError({ property: 'foo', limit: 2 });
 *     // { location: 'body', path: '/foo', message: 'should NOT be shorter than 2 characters', validation: 'minLength' }
 */
exports.minLengthError = (options = {}) => {
  const property = options.property;
  const limit = options.limit;
  return {
    location: options.location || 'body',
    path: options.path || `/${property}`,
    message: options.message || `should NOT be shorter than ${limit} characters`,
    validation: options.validation || 'minLength'
  };
};

/**
 * Builds a validation error object as returned by the API when an integer is
 * less than the minimum required by a JSON schema.
 *
 *     minimumError({ property: 'foo', min: 2 });
 *     // { location: 'body', path: '/foo', message: 'should be >=2', validation: 'minimum' }
 */
exports.minimumError = (options = {}) => {
  const property = options.property;
  const min = options.min;
  return {
    location: options.location || 'body',
    path: options.path || `/${property}`,
    message: options.message || `should be >= ${min}`,
    validation: options.validation || 'minimum'
  };
};

/**
 * Builds a validation error object as returned by the API when an array has
 * less items than the minimum required by a JSON schema.
 *
 *     minItemsError({ property: 'foo', min: 2 });
 *     // { location: 'body', path: '/foo', message: 'should NOT have fewer than 2 items', validation: 'minItems' }
 */
exports.minItemsError = (options = {}) => {
  const property = options.property;
  const min = options.min;
  return {
    location: options.location || 'body',
    path: options.path || `/${property}`,
    message: options.message || `should NOT have fewer than ${min} items`,
    validation: options.validation || 'minItems'
  };
};

/**
 * Builds a validation error object as returned by the API when a property
 * required by a JSON schema is missing.
 *
 *     missingPropertyError({ property: 'foo' });
 *     // { location: 'body', path: '', message: "should have required property 'foo'", validation: 'required' }
 */
exports.missingPropertyError = (options = {}) => {
  const property = options.property;
  return {
    location: options.location || 'body',
    path: options.path || '',
    message: `should have required property '${property}'`,
    validation: 'required'
  };
};

/**
 * Builds a validation error object as returned by the API when
 * an unknow additional properties is encountered.
 *
 *     noAdditionalPropertiesError({ });
 *     // { location: 'body', path: '', message: "should not have additional property 'foo'", validation: 'additionalProperties' }
 */
exports.noAdditionalPropertiesError = (options = {}) => {
  return {
    location: options.location || 'body',
    path: '',
    message: `should NOT have additional properties`,
    validation: 'additionalProperties'
  };
};

/**
 * Builds a validation error object as returned by the API when a property does
 * not match the type(s) required by a JSON schema.
 *
 *     typeError({ property: 'foo', type: 'boolean' });
 *     // { location: 'body', path: '/foo', message: "should be a boolean", validation: 'type' }
 *
 *     typeError({ location: 'query', property: 'bar', type: 'integer', array: true });
 *     // { location: 'query', path: '/bar', message: "should be an integer or an array of integers", validation: [ 'oneOf', 'type' ] }
 */
exports.typeError = (options = {}) => {
  const property = options.property;

  let type = options.type;
  let validation = 'type';
  if (options.array) {
    type = `an ${options.type} or an array of ${options.type}s`;
    validation =  [ 'oneOf', 'type' ];
  }

  return {
    location: options.location || 'body',
    path: options.path || `/${property}`,
    validation,
    message: `should be ${type}`
  };
};

/**
 * Builds a validation error object as returned by the API when the value of a
 * property violates a unique constaint in the database.
 *
 *     uniqueError({ property: 'foo' });
 *     // { location: 'body', path: '/foo', message: "foo must be unique", validation: 'unique' }
 */
exports.uniqueError = (options = {}) => {
  const property = options.property;
  return {
    location: options.location || 'body',
    path: options.path || `/${property}`,
    message: options.message || `${property} must be unique`,
    validation: 'unique'
  };
};
