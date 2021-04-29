const { Assertion, expect } = require('chai');

const { forbidNegate, sortValidationErrors } = require('./utils');
const { ensureTranslation } = require('../utils/i18n');

/**
 * Chai method helper to check that the body of an HTTP response represents an
 * API validation error response concerning the request body, with the specified
 * errors.
 *
 *     expect(res).to.have.requestBodyValidationErrors([
 *       { error: 1 },
 *       { foo: 'bar' }
 *     ]);
 *
 * The response must contain exactly the specified error objects, no fewer and
 * no more, although they may be in any order.
 *
 * By default, this assertion expects the body of the HTTP response to be a
 * standard HTTP Problem Details object with the default validation error
 * detail message. If you expect a different detail message, use the `detail`
 * option:
 *
 *     expect(res).to.have.requestBodyValidationErrors(
 *       [
 *         { error: 1 },
 *         { foo: 'bar' }
 *       ],
 *       { detail: 'Custom detail message' }
 *     );
 */
Assertion.addMethod('requestBodyValidationErrors', function(expectedErrors, options = {}) {

  // This assertion is too complex to support negation with `.not`.
  forbidNegate(this);

  const res = this._obj;
  const expectedDetail = options.detail || ensureTranslation('general.validationErrors');

  new Assertion(res)
    .to.have.status(422)
    .and.to.have.httpProblemDetailsBody(
      {
        type: 'https://httpstatuses.com/422',
        title: 'Unprocessable Entity',
        status: 422,
        detail: expectedDetail,
        errors: actualErrors => expect(sortValidationErrors(actualErrors)).to.deep.equal(sortValidationErrors(expectedErrors))
      }
    )
    .and.to.matchJsonSchema('RequestBodyValidationErrorsResponse');
});
