const config = require('../../config');
const { expect } = require('../utils/chai');

/**
 * Expects the specified mail mock to have never been called.
 *
 * @param {Function} sendMailMock - The mock to check.
 */
exports.expectNoMailSent = sendMailMock => {
  expect(sendMailMock).to.have.callCount(0);
};

/**
 * Expects the specified mail mock to have been called once to send the
 * specified email. Note that this assertion does not check the contents of the
 * email, only its sender, recipient and subject.
 *
 * @param {Function} sendMailMock - The mock to check.
 * @param {Object} expected - The mail that should have been sent.
 * @param {string} [expected.from] - The sender of the email. Defaults to the
 * sender in the application's configuration.
 * @param {string} expected.to - The recipient of the email.
 * @param {string} expected.subject - The subject of the email.
 * @returns {Object} The mail that was sent, including its content (in the
 * "html" property).
 */
exports.expectOneMailSent = (sendMailMock, expected) => {
  expect(sendMailMock).to.have.callCount(1);

  const sentMail = sendMailMock.firstCall.args[0];
  expect(sentMail)
    .to.have.all.keys('from', 'html', 'subject', 'to')
    .and.to.include({
      from: expected.from || config.smtp.from,
      subject: expected.subject,
      to: expected.to
    })
    .and.to.have.property('html').which.is.a('string');

  expect(sendMailMock.firstCall.args).to.eql([ sentMail ]);

  return sentMail;
};
