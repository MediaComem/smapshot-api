const { Assertion } = require('chai');
const { isEqual } = require('lodash');

const { buildExpectedObject, describeResponse } = require('./utils');

/**
 * Chai method helper to check whether an HTTP response has the expected JSON
 * body with the appropriate Content-Type header.
 *
 *     expect(res).to.have.jsonBody({
 *       id: 42,
 *       firstName: 'Peter',
 *       lastName: 'Gibbons'
 *     });
 *
 * If the assertion fails, a full representation of the response, including its
 * status, headers and body, is included in the error message to help identify
 * the issue.
 */
Assertion.addMethod('jsonBody', function(propertyExpectations, options = {}) {
  const res = this._obj;

  const actual = res.body;
  const expected = buildExpectedObject(actual, propertyExpectations);
  const expectedContentType = options.contentType || 'application/json; charset=utf-8';

  const msgFactory = to => [
    `expected HTTP response ${to} have the correct JSON body with the "${expectedContentType}" Content-Type header, but the response was:`,
    describeResponse(res)
  ].join('\n\n')

  this.assert(
    isEqual(actual, expected) && res.headers['content-type'] === expectedContentType,
    msgFactory('to'),
    msgFactory('not to'),
    expected,
    actual
  );
});
