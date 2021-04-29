const nodemailer = require('nodemailer');

const SEND_MAIL = Symbol('SEND_MAIL');

/**
 * Creates a function to send emails with https://nodemailer.com.
 *
 * @param {Object} smtpConfig - SMTP configuration.
 * @param {string} smtpConfig.host - The hostname of the SMTP server.
 * @param {number} smtpConfig.port - The port of the SMTP server.
 * @param {boolean} [smtpConfig.secure=false] - If true the connection will use
 * TLS when connecting to the server. If false (the default) then TLS is used if
 * the server supports the STARTTLS extension. In most cases set this value to
 * true if you are connecting to port 465. For port 587 or 25 keep it false.
 * @param {string} [smtpConfig.username] - The optional user to authenticate as.
 * @param {string} [smtpConfig.password] - The optional password to authenticate
 * with.
 * @param {boolean} [smtpConfig.allowInvalidCertificate=false] - If set to true,
 * Nodemailer will not check whether the SSL/TLS certificate of the SMTP server
 * is valid.
 * @returns {Function} A function that sends emails using the configured SMTP
 * server.
 */
exports.createSendMail = smtpConfig => {

  const smtpTransport = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: {
      user: smtpConfig.username,
      pass: smtpConfig.password
    },
    tls: {
      rejectUnauthorized: !smtpConfig.allowInvalidCertificate
    }
  });

  return options => smtpTransport.sendMail(options);
};

/**
 * Returns the email-sending function injected into the specified Express
 * application. An error is thrown if it was not injected.
 *
 * @param {express.Express} app - An Express application.
 * @returns {Function} The function to send emails.
 */
exports.getSendMail = (app) => {

  const sendMail = app.get(SEND_MAIL);
  if (!sendMail) {
    throw new Error(`No ${SEND_MAIL} service was injected into this application`);
  }

  return sendMail;
};

/**
 * Injects an email-sending function into an Express application. It can later
 * be used with `sendMail`.
 *
 * @param {express.Express} app - An Express application.
 * @param {Function} sendMailFunc - The function to send emails.
 */
exports.injectSendMail = (app, sendMailFunc) => {
  if (typeof sendMailFunc !== 'function') {
    throw new Error('Mailer must be a function');
  }

  return app.set(SEND_MAIL, sendMailFunc);
};

/**
 * Sends an email.
 *
 * This function must be passed an Express application into which an
 * email-sending function has previously been injected with `injectSendMail`.
 *
 * @param {express.Express} app - An Express application.
 * @param {Object} options - Email options (see
 * https://nodemailer.com/message/).
 * @param {string} options.subject - The subject of the email.
 * @param {string} options.from - The email address of the sender.
 * @param {string} options.to - Comma separated list or an array of recipients
 * email addresses.
 * @returns {Promise} A promise that will be resolved when the email has been
 * sent, or rejected if it could not be sent.
 */
exports.sendMail = (app, options) => exports.getSendMail(app)(options);
