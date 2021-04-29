const { Assertion } = require('chai');

/**
 * Chai method helper to check whether a date is immediately after another date
 * (within 1 second). Useful to check the creation date of a newly created API
 * resource, which cannot be known exactly, but would be expected to be
 * soon after the start of the test.
 *
 *     const now = new Date();
 *     const soonAfter = new Date(now.getTime() + 250);
 *
 *     expect(soonAfter).to.be.immediatelyAfter(now);
 */
Assertion.addMethod('immediatelyAfter', function(lowerBoundDate) {
  const dateOrTimestamp = this._obj;

  const typeMsgFactory = to => `expected #{this} ${to} be a Date or a Unix timestamp`;

  this.assert(
    Number.isInteger(dateOrTimestamp) || dateOrTimestamp instanceof Date,
    typeMsgFactory('to'),
    typeMsgFactory('not to')
  );

  let date = dateOrTimestamp;

  // If the value is a Unix timestamps in seconds, transform it into a Date and
  // truncate the milliseconds off of the lower bound.
  if (Number.isInteger(date)) {
    date = new Date(dateOrTimestamp * 1000);
    lowerBoundDate = new Date(Math.floor(lowerBoundDate / 1000) * 1000);
  }

  const differenceInMilliseconds = date.getTime() - lowerBoundDate.getTime();
  const msgFactory = to => `expected ${dateOrTimestamp} ${to} be immediately after ${lowerBoundDate} within 1 second, but the difference is ${differenceInMilliseconds}ms`;

  this.assert(
    differenceInMilliseconds >= 0 && differenceInMilliseconds <= 1000,
    msgFactory('to'),
    msgFactory('not to')
  );
});
