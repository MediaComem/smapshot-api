const config = require('../config');
const logger = require('../config/logger');
const { createApplication, getHttpServer } = require('./express');
const { createSendMail } = require('./services/send-mail');

module.exports = () => new Promise((resolve, reject) => {

  const app = createApplication({
    sendMail: createSendMail(config.smtp)
  });

  const server = getHttpServer(app);

  // Listen on the provided port, on all network interfaces.
  server.listen(config.port);
  server.on('error', onError);
  server.on('listening', onListening);

  function onError(error) {
    if (error.syscall !== 'listen') {
      return reject(error);
    }

    // Handle specific listen errors with friendly messages.
    switch (error.code) {
      case 'EADDRINUSE':
        return reject(new Error(`Port ${config.port} is already in use`));
      default:
        return reject(error);
    }
  }

  function onListening() {
    logger.info(`Listening on port ${config.port}`);
    logger.debug(`API URL is ${config.apiUrl}`);
    logger.debug(`OpenAPI documentation is available at ${config.apiUrl}/docs`);
    resolve();
  }
});
