const { Assertion } = require('chai');

/**
 * Chai method helper to check that an HTTP response is an HTTP problem details
 * object.
 *
 *     expect(res).to.have.httpProblemDetailsBody({
 *       type: 'https://httpstatuses.com/500',
 *       title: 'Oops',
 *       status: 500
 *     });
 *
 * If the assertion fails, a full representation of the response, including its
 * status, headers and body, is included in the error message to help identify
 * the issue.
 */
Assertion.addMethod('httpProblemDetailsBody', function(expected) {
  const res = this._obj;
  new Assertion(res)
    .to.have.status(expected.status)
    .and.jsonBody(expected, {
      contentType: 'application/problem+json; charset=utf-8'
    });
});
