const { compareSync } = require('bcrypt');
const { Assertion } = require('chai');

/**
 * Chai method helper to check whether a bcrypt hash is for the correct
 * password.
 *
 *     const hash = '$2y$04$tD25KT05wdbDDYS3tRjXbehecCqhyCRYoSgNWvvHUeT0qEkd1tGp2';
 *     expect(hash).to.be.bcryptHashFor('my-secret-password');
 */
Assertion.addMethod('bcryptHashFor', function(password) {
  const hash = this._obj;

  const msgFactory = to => `expected ${JSON.stringify(hash)} ${to} be a bcrypt hash for password ${JSON.stringify(password)}`;

  this.assert(
    typeof hash === 'string' && compareSync(password, hash),
    msgFactory('to'),
    msgFactory('not to')
  );
});
