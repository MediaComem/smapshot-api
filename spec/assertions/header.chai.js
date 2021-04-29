const { Assertion } = require('chai');

const { describeResponse } = require('./utils');

/**
 * Chai method helper to check that an HTTP response has a specific header with
 * the expected value.
 *
 *     expect(res).to.have.header('Content-Type', 'application/json');
 *
 * If the assertion fails, a full representation of the response, including its
 * status, headers and body, is included in the error message to help identify
 * the issue.
 */
Assertion.addMethod('header', function(name, expected) {
  const res = this._obj;
  const actual = res.headers[name.toLowerCase()];

  const msgFactory = to => [
    `expected HTTP response ${to} have header ${name} with value ${expected}`,
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
