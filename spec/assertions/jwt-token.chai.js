const { Assertion } = require('chai');
const jwt = require('jsonwebtoken');
const { isEqual } = require('lodash');

const config = require('../../config');
const { buildExpectedObject } = require('./utils');

/**
 * Chai method helper to check whether a string is a valid JWT token from this
 * application with the expected claims.
 *
 *     expect(res).to.be.jwtToken({
 *       sub: 42
 *     });
 */
Assertion.addMethod('jwtToken', function(propertyExpectations) {
  const token = this._obj;
  const claims = jwt.verify(token, config.jwtSecret);

  const actual = claims;
  const expected = buildExpectedObject(actual, propertyExpectations);

  const msgFactory = to => `expected JWT token ${to} have the expected claims`;

  this.assert(
    isEqual(actual, expected),
    msgFactory('to'),
    msgFactory('not to'),
    expected,
    actual
  );
});
