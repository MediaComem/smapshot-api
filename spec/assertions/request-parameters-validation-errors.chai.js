const { Assertion, expect } = require('chai');

const { forbidNegate, sortValidationErrors } = require('./utils');
const { ensureTranslation } = require('../utils/i18n');

/**
 * Chai method helper to check that the body of an HTTP response represents an
 * API validation error response concerning headers, URL query parameters or URL
 * path parameters, with the specified errors.
 *
 *     expect(res).to.have.requestParametersValidationErrors([
 *       { error: 1 },
 *       { foo: 'bar' }
 *     ]);
 *
 * The response must contain exactly the specified error objects, no fewer and
 * no more, although they may be in any order.
 */
Assertion.addMethod('requestParametersValidationErrors', function(expectedErrors) {

  // This assertion is too complex to support negation with `.not`.
  forbidNegate(this);

  const res = this._obj;

  new Assertion(res)
    .to.have.status(400)
    .and.to.have.httpProblemDetailsBody(
      {
        type: 'https://httpstatuses.com/400',
        title: 'Bad Request',
        status: 400,
        detail: ensureTranslation('general.validationErrors'),
        errors: actualErrors => expect(actualErrors).to.not.be.undefined && expect(sortValidationErrors(actualErrors)).to.deep.equal(sortValidationErrors(expectedErrors))
      }
    )
    .and.to.matchJsonSchema('RequestParametersValidationErrorsResponse');
});
