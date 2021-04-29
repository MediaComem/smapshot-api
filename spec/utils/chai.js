const chai = require('chai');
const glob = require('glob');
const path = require('path');
const sinonChai = require('sinon-chai');

// Include our custom assertions.
const assertionsDir = path.join(__dirname, '..', 'assertions');
for (const assertion of glob.sync('**/*.chai.js', { absolute: true, cwd: assertionsDir })) {
  require(assertion);
}

// Include assertions for sinon from https://www.chaijs.com/plugins/sinon-chai/.
chai.use(sinonChai);

// Do not truncate representation of actual and expected values in assertion
// error messages. See https://www.chaijs.com/guide/styles/#configuration.
chai.config.truncateThreshold = 0;

module.exports = chai;
