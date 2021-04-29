const { Assertion } = require('chai');
const { isEqual } = require('lodash');

const { describeResponse } = require('./utils');

/**
 * Chai method helper to ensure that an HTTP response has no response body and
 * no Content-Type header.
 *
 *     expect(res).to.have.noBody();
 *
 * If the assertion fails, a full representation of the response, including its
 * status, headers and body, is included in the error message to help identify
 * the issue.
 */
Assertion.addMethod('noBody', function() {
  const res = this._obj;

  const actual = res.body;

  // The HTTP client used for tests, SuperAgent, returns an empty object for the
  // parsed body when the HTTP response has no body.
  const expected = {};

  const msgFactory = to => [
    `expected HTTP response ${to} have no body and no Content-Type header, but the response was:`,
    describeResponse(res)
  ].join('\n\n')

  this.assert(
    isEqual(actual, expected) && !res.headers['content-type'],
    msgFactory('to'),
    msgFactory('not to'),
    expected,
    actual
  );
});
