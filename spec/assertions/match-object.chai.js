const { Assertion } = require('chai');
const { isEqual } = require('lodash');

const { buildExpectedObject, describeData } = require('./utils');

/**
 * Chai method helper to check whether an object has the expected properties. If
 * one of the properties is not known in advance, you can use an expectation to
 * check that its value is correct instead.
 *
 *     expect(res.body).to.matchObject({
 *       // Maybe you cannot know the ID in advance, but you know it should be a number.
 *       id: id => expect(id).to.be.a('number'),
 *       firstName: 'Peter',
 *       lastName: 'Gibbons'
 *     });
 */
Assertion.addMethod('matchObject', function(propertyExpectations) {

  const actual = this._obj;
  const expected = buildExpectedObject(actual, propertyExpectations);

  const msgFactory = to => [
    'expected object',
    describeData(actual),
    `${to} match object`,
    describeData(expected)
  ].join('\n\n');

  this.assert(
    isEqual(actual, expected),
    msgFactory('to'),
    msgFactory('not to'),
    expected,
    actual
  );
});
