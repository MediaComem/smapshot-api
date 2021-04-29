const { Assertion, expect, util } = require('chai');
const { get, isArray, isPlainObject, mapValues, reduce } = require('lodash');
const queryString = require('querystring');

/**
 * Builds an object that represents the expected value of another object, and
 * optionally verifies some of its properties with custom assertions.
 *
 * This is useful, for example, if you want to check the contents of an HTTP
 * response, and you know the format of some properties but not their expected
 * value. For example, you cannot know the ID of a newly created API resource
 * before actually creating it.
 *
 *     const actualResponseBody = {
 *       id: 42,
 *       name: 'John Doe'
 *     };
 *
 *     const expectedResponseBody = buildExpectedObject(actualResponseBody, {
 *       // Run assertions on properties you do not know the exact value of.
 *       id: actualId => expect(actualId).to.be.a('number').and.be.above(0),
 *       name: 'John Doe'
 *     });
 *
 *     // The resulting object contains both the fixed properties you specified,
 *     // and the actual values of the properties you ran assertions on.
 *     console.log(expectedResponseBody.id);    // 42
 *     console.log(expectedResponseBody.name);  // 'John Doe'
 *
 *     // You can now compare the entire exact response and get a pretty diff
 *     // between the actual and expected response if they do not match.
 *     expect(actualResponseBody).to.deep.equal(expectedResponseBody);
 *
 * This assertion also works with arrays:
 *
 *     const actual = [
 *       { name: 'John Doe' },
 *       { name: 'John Smith' }
 *     ];
 *
 *     const expected = buildExpectedObject(actual, [
 *       { name: 'John Doe' },
 *       { name: name => expect(name).to.be.a('string') }
 *     ]);
 *
 *     // Note that the array's elements are expected to be in the exact order
 *     // specified.
 *     expect(actual).to.deep.equal(expected);
 *
 * @param {(Object|Array)} actual - The actual object to check.
 * @param {(Object|Array)} propertyExpectations - Expected properties or
 * functions that receive the value of the property and return a Chai assertion
 * on that property.
 * @returns {Object} An expected object that should match the actual object.
 */
exports.buildExpectedObject = (actual, propertyExpectations) => {
  if (isArray(propertyExpectations) && !isArray(actual)) {
    // If the expectation is an array but the actual value is not, make a
    // failing assertion.
    expect(actual, 'expected value to be an array').to.be.an('array');
  } else if (isArray(propertyExpectations) && isArray(actual)) {
    // Recursively build expectations in array values.
    expect(actual.length, 'expected value to have correct number of elements').to.equal(propertyExpectations.length);
    return propertyExpectations.map((expectation, index) => exports.buildExpectedObject(actual[index], expectation));
  } else if (isPlainObject(propertyExpectations) && !isPlainObject(actual)) {
    // If the expectation is a plain object but the actual value is not, make a
    // failing assertion.
    expect(actual, 'expected value to be a plain object').to.satisfy(isPlainObject)
  } else if (isPlainObject(propertyExpectations) && isPlainObject(actual)) {
    // Recursively build expectations in object property values.
    return mapValues(propertyExpectations, (expectedPropertyValue, property) => {
      const actualPropertyValue = get(actual, property);
      return exports.buildExpectedObject(actualPropertyValue, expectedPropertyValue);
    });
  }

  // If neither the expectation nor the actual value are arrays or objects,
  // compare them directly.
  return buildExpectedValue(actual, propertyExpectations);
};

/**
 * Describes arbitrary data by pretty-printing it as JSON and indenting it for
 * inclusion into a detailed error message.
 *
 * @param {Object} data - The data to describe.
 * @param {Object} [options] - Formatting options.
 * @param {number} [options.indent=2] - How many spaces to indent the output by.
 * @returns {string} A human-readable description of the data.
 */
exports.describeData = (data, options = {}) => {
  const indent = options.indent !== undefined ? options.indent : 2;
  return JSON.stringify(data, undefined, 2).replace(/^/gm, ' '.repeat(indent));
};

/**
 * Describes an HTTP request object for inclusion in an error message.
 *
 * @param {Object} req - The request to describe.
 * @param {string} req.method - The method of the request (e.g. "POST").
 * @param {string} req.path - The request path.
 * @param {Object} [req.query] - Optional URL query parameters.
 * @param {Object} [req.headers] - Optional request headers.
 * @param {Object} [options] - Formatting options.
 * @param {number} [options.indent=2] - How many spaces to indent the output by.
 * @returns {string} A human-readable description of the request.
 */
exports.describeRequest = (req, options = {}) => {
  const indent = options.indent !== undefined ? options.indent : 2;

  const parts = [
    `${req.method.toUpperCase()} ${describeRequestUri(req)} HTTP/1.1`
  ];

  if (req.headers) {
    parts.push(describeHttpHeaders(req.headers));
  }

  if (req.body) {
    parts.push('', JSON.stringify(req.body, undefined, 2));
  } else {
    parts.push('', '(no body)');
  }

  return parts.join('\n').replace(/^/gm, ' '.repeat(indent));
};

/**
 * Describes an HTTP response for inclusion in an error message.
 *
 *     describeResponse(res);
 *     // HTTP/1.1 200 OK
 *     // content-type: application/json; charset=utf-8
 *     //
 *     // {"foo":"bar"}
 *
 * @param {Response} res - The response to describe.
 * @param {Object} [options] - Formatting options.
 * @param {number} [options.indent=2] - How many spaces to indent the output by.
 * @returns {string} A human-readable description of the response.
 */
exports.describeResponse = (res, options = {}) => {
  const indent = options.indent !== undefined ? options.indent : 2;

  const parts = [
    `HTTP/${res.res.httpVersion} ${res.status} ${res.res.statusMessage}`,
    describeHttpHeaders(res.headers)
  ];

  if (res.text) {
    parts.push('', res.text);
  } else {
    parts.push('', '(no body)');
  }

  return parts.join('\n').replace(/^/gm, ' '.repeat(indent));
};

/**
 * Throws an error if a Chai assertion is negated (i.e. the chain includes a
 * call to `.not`).
 *
 * @param {*} assertion - A Chai assertion.
 */
exports.forbidNegate = assertion => {
  const negate = util.flag(assertion, 'negate');
  if (negate) {
    throw new Error('Negation is not supported for this assertion');
  }
};

/**
 * Sort validation errors from this API so that order-insensitive assertions can
 * be made on the body of HTTP responses. By sorting both the actual errors in
 * the response and the expected errors with this function, both lists can be
 * compared exactly while ignoring their order.
 *
 * This function returns a new array.
 *
 * @param {Object[]} errors - The errors to sort.
 * @returns {Object[]} Sorted errors.
 */
exports.sortValidationErrors = errors => {
  return errors.slice().sort((a, b) => {

    // Sort by the "location" property if present.
    let result = String(get(a, 'location')).localeCompare(String(get(b, 'location')));
    if (result !== 0) {
      return result;
    }

    // Sort by the "path" property if present.
    result = String(get(a, 'path')).localeCompare(String(get(b, 'path')));
    if (result !== 0) {
      return result;
    }

    // Fall back to sorting by the JSON representation of each error.
    return JSON.stringify(a).localeCompare(JSON.stringify(b));
  });
}

/**
 * Returns the specified expected value for comparison with an actual value.
 *
 * If the expected value is a function, that function is passed the actual value
 * and must return a Chai assertion on that value. If the assertion passes, the
 * actual value is returned.
 *
 * @param {*} actual - The actual value to check.
 * @param {*} expected - The expected value or a function that receives the
 * value and returns a Chai assertion on that value.
 * @returns {*} The value.
 */
function buildExpectedValue(actual, expected) {
  if (typeof expected !== 'function') {
    return expected;
  }

  const assertion = expected(actual);
  if (!(assertion instanceof Assertion)) {
    throw new Error('Custom value expectations must be Chai assertions; did you use expect?');
  }

  return actual;
}

/**
 * Describes a map of HTTP response headers for inclusion in an error message.
 *
 *     describeHttpHeaders({ a: 'b', c: [ 'd', 'e' ]});
 *     // a: b
 *     // c: d
 *     // c: e
 *
 * @param {Object} headers - A map of HTTP response header names and their
 * values.
 * @returns {string} A human-readable description of the headers.
 */
function describeHttpHeaders(headers) {
  return reduce(
    headers,
    (memo, value, name) => [ ...memo, describeHttpHeader(name, value) ],
    []
  ).join('\n');
}

/**
 * Describes an HTTP response header for inclusion in an error message.
 *
 *     describeHttpHeader('a', 'b');
 *     // a: b
 *
 *     describeHttpHeader('a', [ 'b', 'c' ]);
 *     // a: b
 *     // a: c
 *
 * @param {string} name - The name of the header.
 * @param {string|string[]} valueOrValues - One or multiple values.
 * @returns {string} A human-readable description of the header.
 */
function describeHttpHeader(name, valueOrValues) {
  if (Array.isArray(valueOrValues)) {
    return valueOrValues.map(value => describeHttpHeader(name, value)).join('\n');
  }

  return `${name}: ${valueOrValues}`;
}

/**
 * Describes the request URI of an HTTP request object as it would be formatted
 * in the request line.
 *
 *     describeRequestUri({ path: '/example' });                         // "/example"
 *     describeRequestUri({ path: '/example', query: { foo: 'bar' } });  // "/example?foo=bar"
 *
 * @param {Object} req - The request to describe.
 * @param {string} req.path - The request path.
 * @param {Object} [req.query] - Optional URL query parameters.
 * @returns {string} A human-readable description of the request URI.
 */
function describeRequestUri({ query, path }) {
  return query ? `${path}?${queryString.stringify(query)}` : path;
}
