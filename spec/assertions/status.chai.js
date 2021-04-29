const { Assertion } = require('chai');

const { describeResponse } = require('./utils');

/**
 * Chai method helper to check that the status of an HTTP response is as expected.
 *
 *     expect(res).to.have.status(200);
 *
 * If the assertion fails, a full representation of the response, including its
 * status, headers and body, is included in the error message to help identify
 * the issue.
 */
Assertion.addMethod('status', function(expected) {
  const res = this._obj;
  const actual = res.status;

  const msgFactory = to => [
    `expected HTTP response ${to} have status ${expected} but got ${actual}`,
    describeResponse(res)
  ].join('\n\n');

  this.assert(
    actual === expected,
    msgFactory('to'),
    msgFactory('not to'),
    expected,
    actual
  );
});
