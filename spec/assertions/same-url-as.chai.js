const { Assertion } = require('chai');
const { get } = require('lodash');
const { URL } = require('url');

/**
 * Chai method helper to check whether a URL is identical to another URL. Any
 * URL property may be excluded from the check, e.g. query params or the path.
 *
 *     expect('http://example.com/foo').to.be.sameUrlAs('http//example.com/foo');                       // Ok
 *     expect('http://example.com/foo').to.be.sameUrlAs('http//example.com/bar');                       // AssertionError
 *     expect('http://example.com/foo').to.be.sameUrlAs('http//example.com/bar', { pathname: false });  // Ok
 */
Assertion.addMethod('sameUrlAs', function(urlOrString, options = {}) {
  const actual = toUrl(this._obj);
  const expected = toUrl(urlOrString);

  const urlPropertiesToCheck = [
    'protocol', // http://
    'username', // user
    'password', // :pass
    'hostname', // @hostname
    'port',     // :port
    'pathname', // /some/path
    'search',   // ?query=params
    'hash'      // #hash
  ].filter(property => get(options, property, true));

  const isSameUrl = urlPropertiesToCheck.reduce(
    (memo, property) => memo && actual[property] === expected[property],
    true
  );

  const msgFactory = to => `expected ${actual} ${to} have the same ${urlPropertiesToCheck.join(', ')} properties as ${expected}`;

  this.assert(
    isSameUrl,
    msgFactory('to'),
    msgFactory('not to'),
    expected,
    actual
  );
});

function toUrl(object) {
  return object instanceof URL ? object : new URL(object);
}
