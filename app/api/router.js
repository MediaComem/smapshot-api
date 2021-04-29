const express = require('express');
const glob = require('glob');
const path = require('path');

// Load all defined routes for the API.
const routers = findAndRequireRouteFilesMatching('./**/*.routes.js');

/**
 * Creates the main API router.
 *
 * @param {express.Express} app - The Express application which will use the API
 * as a middleware.
 * @returns {express.Router} An Express router.
 */
module.exports = app => {
  const mainApiRouter = new express.Router();
  routers.forEach(router => plugLoadedRouter(app, mainApiRouter, router));
  return mainApiRouter;
};

function findAndRequireRouteFilesMatching(pattern) {
  return glob.sync(pattern).map(file => require(path.resolve(file)));
}

function isRouter(router) {
  return router && Object.getPrototypeOf(router) === express.Router;
}

function plugLoadedRouter(app, mainApiRouter, routerOrFactory) {

  // If the loaded module is a router, plug it into the main API router as is.
  if (isRouter(routerOrFactory)) {
    return mainApiRouter.use(routerOrFactory);
  }

  // Otherwise, the module must export a factory function that returns a router
  // when called with the Express application. Call that function to build the
  // router, and plug it into the main API router.
  const router = routerOrFactory(app);
  if (!isRouter(router)) {
    throw new Error('Router factory function must return an Express Router');
  }

  return mainApiRouter.use(router);
}
