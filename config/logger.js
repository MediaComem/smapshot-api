const { isString } = require('lodash');
const winston = require('winston');

const config = require('./precompile'); // Use the precompile configuration.

const { combine, timestamp, colorize, padLevels, printf, splat } = winston.format;

// If the logged object is an error, use its stack trace as the message. (The
// stack trace also contains the error message in its first line.)
const errorsStackTrace = winston.format(info => {
  if (info instanceof Error || isString(info.stack)) {
    return {
      ...info,
      message: info.stack
    };
  }

  return info;
});

// If the log metadata includes a request ID, prepend it to the log message.
const requestId = winston.format(info => {
  if (info.requestId) {
    info.message = `[req ${info.requestId}] ${info.message}`;
  }

  return info;
});

// The log message format for this application.
const myFormat = printf(info => `${info.timestamp} ${info.level} ${info.message}`);

// Note: "silent" is not an actual Winston log level, but it can be used in the
// configuration to disable all logging, e.g. during tests.
const silent = config.logLevel === 'silent';
const logLevel = silent ? 'error' : config.logLevel;

const logger = winston.createLogger({
  format: combine(
    // Note: this format must be configured here for the logger, not below for
    // the transport.
    errorsStackTrace()
  ),
  transports: [
    new winston.transports.Console({
      silent,
      level: logLevel,
      handleExceptions: true,
      json: false,
      colorize: true,
      format: combine(
        requestId(),
        padLevels(),
        colorize(),
        timestamp(),
        splat(),
        myFormat
      )
    })
  ],
  // Do not exit on handled exceptions.
  exitOnError: false
});

// Create a stream object with a `write` function that will be used by the
// `morgan` logger. It logs HTTP requests going through the Express application.
logger.stream = {
  write(message) {
    logger.http(message);
  }
};

module.exports = logger;
