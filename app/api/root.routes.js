const express = require('express');

const controller = require('./root.controller.js');

const router = new express.Router();

router.get('/', controller.getRoot);

module.exports = router;
