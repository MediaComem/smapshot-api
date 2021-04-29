const { Assertion } = require('chai');
const { round } = require('lodash');

/**
 * Chai method helper to check whether a computed floating point value is close
 * enough to an expected value. This assertion can be used when calculations do
 * not yield an exact result (e.g. a longitude calculated with a PostGIS
 * function).
 *
 *     // Check that value is approximately equal to 3.14 within 2 digits
 *     // (the precision is deduced from the expected value).
 *     expect(value).to.be.closeToWithPrecision(3.14);
 *
 *     // Check that value is approximately equal to 3.14159265 within 3 digits
 *     // (the precision is explicitly provided).
 *     expect(value).to.be.closeToWithPrecision(3.14159265, 3);
 *
 * This assertion is similar to Chai's closeTo/approximately assertion but with
 * a precision specified in number of digits and which is deduced automatically
 * from the expected value.
 */
Assertion.addMethod('closeToWithPrecision', function(expected, precision) {
  const actual = this._obj;

  // Automatically determine the required precision from the expected value by
  // default.
  precision = precision !== undefined ? precision : getPrecisionOf(expected);

  const msgFactory = to => `expected ${actual} ${to} be close to ${expected} within ${precision} digits`;

  this.assert(
    round(actual, precision) === round(expected, precision),
    msgFactory('to'),
    msgFactory('not to')
  );
});

function getPrecisionOf(n) {
  if (typeof n !== 'number') {
    throw new Error(`Value must be a number, got ${n} (type ${typeof n})`);
  } else if (!isFinite(n)) {
    return 0;
  }

  let e = 1, p = 0;
  while (Math.round(n * e) / e !== n) {
    e *= 10;
    p++;
  }

  return p;
}
