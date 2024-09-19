const { randomBytes } = require('crypto');
const expressWs = require('@small-tech/express-ws');
const bodyParser = require('body-parser');
const cors = require("cors");
const express = require('express');
const session = require('express-session');
const helmet = require("helmet");
const http = require("http");
const httpStatusCodes = require('http-status-codes');
const i18n = require("i18n");
const { isFunction } = require('lodash');
const MemoryStore = require('memorystore')(session);
const morgan = require("morgan");
const passport = require("passport");
const path = require('path');

const apiRouterFactory = require('./api/router');
const config = require('../config');
const logger = require('../config/logger');
const globalErrorHandler = require('./global-error-handler');
const jwtAuthStrategy = require('./passport/jwt.auth-strategy');
const localAuthStrategy = require('./passport/local.auth-strategy');
const googleAuthStrategy = require('./passport/google.auth-strategy');
const facebookAuthStrategy = require('./passport/facebook.auth-strategy');
const { injectSendMail } = require('./services/send-mail');

const HTTP_SERVER = Symbol('HTTP_SERVER');

/**
 * Creates the Express application for this API.
 *
 * @param {ApplicationDependencies} deps - Third-party services such as
 * Nodemailer for emails. They can easily be replaced by mocks for testing.
 * @returns {express.Express} An Express application.
 */
exports.createApplication = ({ sendMail }) => {

  const app = express();

  injectSendMail(app, sendMail);

  const server = http.createServer(app);
  app.set(HTTP_SERVER, server);
  expressWs(app, server);

  // Parse application/json
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  // Secure the app by setting various HTTP headers.
  app.use(helmet());
  const corsOptions = {
    exposedHeaders: 'Total-Items',
  };
  app.use(cors(corsOptions));

  // Session - Used only for Google and Facebook Authentication
  const optionSession = {
    secret: config.jwtSecret,
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1800000 },
    store: new MemoryStore({
      checkPeriod: config.env !== 'test' ? 1800000 : undefined // prune expired entries every 30 minutes
    })
  };

  if (app.get('env') === 'production') {
    app.set('trust proxy', 1) // trust first proxy
    optionSession.cookie.secure = true // serve secure cookies
  }

  app.use(session(optionSession));

  // i18n
  i18n.configure({
    locales: ['en', 'fr', 'de', 'it', 'pt'],
    defaultLocale: config.langFallback, // When changing the value here, you need as well to change the function getFieldI18n manually in utils/params.js
    fallbacks: { '*': config.langFallback },
    queryParameter: 'lang',
    autoReload: (app.get('env') === 'development'),
    preserveLegacyCase: true,
    updateFiles: false,
    objectNotation: true,
    directory: path.join(config.root, 'locales')
  });
  app.use(i18n.init);

  // Authentication
  app.use(passport.initialize());
  jwtAuthStrategy(passport);
  localAuthStrategy(passport);
  googleAuthStrategy(passport);
  facebookAuthStrategy(passport);

  // Assign a random ID to requests and create a child logger which will
  // automatically include it in log messages.
  app.use((req, res, next) => {
    req.id = generateRequestId();
    req.logger = logger.child({ requestId: req.id });
    next();
  });

  // HTTP request logging
  app.use(morgan('[req :id] :remote-addr ":method :url HTTP/:http-version" :status - :res[content-length] bytes - :total-time ms', { stream: logger.stream }));

  // Routes
  app.use(apiRouterFactory(app));

  // Static assets and documentation
  if (app.get('env') === 'development' && config.apiProductionUrl) {
    // only in dev dependencies, do not require it if not in development
    // eslint-disable-next-line
    const { createProxyMiddleware } = require('http-proxy-middleware');
   // `${path2collections}${collection_id}/temp_collada/
   const proxyContext = config.proxyGeoreferencerMode
      ? ['/data/**', '!/data/collections/**/gltf/**', '!/data/collections/**/temp_collada/**']
      : ['/data'];

    const dataProxy = createProxyMiddleware(
      proxyContext,
      {
        target: config.apiProductionUrl,
        changeOrigin: true,
        logProvider: () => logger
      }
    );

    app.use(dataProxy);
  }

  // Serve the contents of the "public" directory in development, which contains
  // sample images for collections. In production, images are served by the
  // reverse proxy.
  if (app.get('env') === 'development') {
    app.use(express.static("public"));
  }

  // Global error handler
  app.use(globalErrorHandler);

  return app;
};

/**
 * Returns the HTTP server associated with the specified Express application.
 * The application must have been created with the `createApplication` function.
 *
 * @param {express.Express} app - An Express application.
 * @returns {http.Server} An HTTP server.
 */
exports.getHttpServer = app => {
  if (!app || !isFunction(app.get)) {
    throw new Error('Argument is not an Express application');
  }

  const server = app.get(HTTP_SERVER);
  if (!server) {
    throw new Error('No HTTP server was configured for this Express application');
  }

  return server;
};

// Configure the morgan HTTP request logger to be aware of our custom request
// ID.
morgan.token('id', req => req.id);

// Configure the morgan HTTP request logger to include the HTTP status code text
// when logging the status code of a response.
morgan.token('status', (req, res) => {
  try {
    const statusText = httpStatusCodes.getStatusText(res.statusCode);
    return `${res.statusCode} ${statusText}`;
  } catch (err) {
    return String(res.statusCode);
  }
});

function generateRequestId() {
  // Generate a number of bytes that is a multiple of 3 and serialize to Base64
  // to get a random-looking string. The reason for the multiple of 3 is that
  // the length of a Base64 string for N bytes will be 4 * ceil(N/3). Using a
  // multiple of 3 avoids having Base64 padding (equal signs) at the end of the
  // string.
  return randomBytes(9).toString('base64');
}

/**
 * @typedef ApplicationDependencies
 * @property {Function} sendMail - The email service.
 */
