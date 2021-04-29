const { stub } = require('sinon');

const { createApplication } = require('../../app/express');

/**
 * Creates a test version of the Express application with external services
 * replaced by mocks.
 *
 * @returns {ApplicationWithMocks} The Express application and all associated
 * mocks.
 */
exports.createApplicationWithMocks = () => {

  const sendMailMock = createSendMailMock();

  const app = createApplication({
    sendMail: sendMailMock
  });

  return {
    app,
    sendMailMock
  };
};

/**
 * Creates a configurable stub of the mail function. All calls fail by default
 * until a specific behavior is specified.
 */
function createSendMailMock() {
  return stub().rejects(new Error('No behavior defined on sendMail mock'));
}

/**
 * @typedef {Object} ApplicationWithMocks
 * @property {express.Express} app - The Express application.
 * @property {Function} sendMail - The mail mock.
 */
