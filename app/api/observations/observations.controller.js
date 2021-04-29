const models = require("../../models");
const { notFoundError } = require("../../utils/errors");
const { route } = require("../../utils/express");
const { cleanProp } = require("../../utils/params");
const { getOwnerScope } = require('./observations.utils');

// POST /observations
// ==================

exports.submit = route(async (req, res) => {
  // user_id 14 reserved for Anonymous volunteers
  const observation = await models.observations.create({
    image_id: req.body.image_id,
    user_id: req.user ? req.user.id : 14,
    observation: req.body.observation,
    coord_x: req.body.coord_x,
    coord_y: req.body.coord_y,
    height: req.body.height,
    width: req.body.width,
    date_created: models.sequelize.literal("current_timestamp")
  });

  res.status(201).send(observation);
});

// PUT /observations/:id
// =====================

exports.update = route(async (req, res) => {
  await req.observation.update({
    state: 'created',
    observation: req.body.observation,
    coord_x: req.body.coord_x,
    coord_y: req.body.coord_y,
    height: req.body.height,
    width: req.body.width
  });

  res.send({
    message: 'The observation has been updated'
  });
});

// PUT /observations/:id/state
// ===========================

exports.validateOrReject = async (req, res) => {
  const state = req.body.state;
  if (state !== 'validated' && state !== 'rejected') {
    throw new Error(`Unsupported observation state transition from ${req.observation.state} to ${state}`);
  }

  await req.observation.update(cleanProp({
    coord_x: req.body.coord_x,
    coord_y: req.body.coord_y,
    height: req.body.height,
    width: req.body.width,
    observation: req.body.observation,
    remark: req.body.remark,
    state: req.body.state,
    validator_id: req.user.id,
    date_validated: models.sequelize.literal("current_timestamp")
  }));

  res.send({
    message: 'The observation has been updated'
  });
};

// DELETE /observations/:id
// ========================

exports.delete = route(async (req, res) => {
  await req.observation.destroy();
  res.send({
    message: "The observation was deleted."
  });
});

// Utility functions & middlewares
// ===============================

exports.findObservation = route(async (req, res, next) => {
  const { include, where } = getOwnerScope(req);

  const observation = await models.observations.findOne({
    include,
    where: {
      ...where,
      id: req.params.id
    }
  });

  if (!observation) {
    throw notFoundError(req);
  }

  req.observation = observation;
  next();
});
