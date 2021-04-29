const { isInteger } = require('lodash');
const { notFoundError } = require('../../utils/errors');
const models = require("../../models");
const { route } = require("../../utils/express");
const { getOwnerScope } = require('./corrections.utils');
const { handleForeignKeyConstraintErrors } = require('../../utils/validation');

// Foreign key constraint errors that should be serialized as human-readable
// validation errors for the client.
const foreignKeyConstraintErrors = [
  {
    index: 'corrections_image_id_fkey1',
    property: 'image_id',
    description: 'image'
  }
];

// POST /corrections
// =================

exports.submit = route(async (req, res) => {
  const lastAcceptedCorrectionId = await findLastAcceptedCorrectionId(req.body.image_id, req.body.type);
  await createNewCorrection(req, lastAcceptedCorrectionId);

  res.status(201).send({
    message: req.__('corrections.submitted.success')
  });
});

async function findLastAcceptedCorrectionId(image_id, type) {
  const max = await models.corrections.max('id', {
    where: {
      image_id,
      type,
      state: 'accepted'
    }
  });

  return isInteger(max) ? max : null;
}

async function createNewCorrection(req, lastAcceptedCorrectionId) {
  try {
    return await models.corrections.create({
      image_id: req.body.image_id,
      user_id: req.user.id,
      correction: req.body.new_value,
      type: req.body.type,
      date_created: models.sequelize.literal("current_timestamp"),
      previous_correction_id: lastAcceptedCorrectionId,
      state: "created"
    });
  } catch (err) {
    handleForeignKeyConstraintErrors(req, err, foreignKeyConstraintErrors);
    throw err;
  }
}

// PUT /corrections/:id
// ====================

exports.update = route(async (req, res) => {
  const [ _, __, newCorrection ] = await Promise.all([
    markCurrentCorrectionAsUpdated(req),
    deletePreviousCorrections(req),
    createValidatedCorrection(req)
  ]);

  await applyCorrectionToImage(newCorrection);

  res.status(200).send({
    message: "The correction has been updated."
  });
});

async function markCurrentCorrectionAsUpdated(req) {
  return req.correction.update(
    {
      state: "updated",
      validator_id: req.user.id,
      remark: req.body.remark || '',
      date_validated: models.sequelize.literal("now()")
    },
    {
      returning: true
    }
  );
}

async function deletePreviousCorrections(req) {
  await models.corrections.destroy({
    where: {
      // Delete any existing updated corrections linked to the current
      // correction.
      previous_correction_id: req.correction.id
    }
  });
}

async function createValidatedCorrection(req) {
  const { id, image_id, type } = req.correction;
  return models.corrections.create({
    image_id: image_id,
    user_id: req.user.id,
    correction: req.body.new_value,
    type: type,
    validator_id: req.user.id,
    state: "accepted",
    date_created: models.sequelize.literal("current_timestamp"),
    date_validated: models.sequelize.literal("now()"),
    // Link back to the current correction.
    previous_correction_id: id
  });
}

// PUT /corrections/:id/state
// ==========================

exports.updateState = async (req, res) => {
  const state = req.body.state;
  switch (state) {
    case "validated":
      await validateCurrentCorrection(req, res);
      break;
    case "rejected":
      await rejectCurrentCorrection(req, res);
      break;
    default:
      throw new Error(`Unsupported transition to correction state ${JSON.stringify(state)}`);
  }

  res.send({
    message: 'The correction has been updated'
  });
};

async function validateCurrentCorrection(req) {
  const updatedCorrection = await markCurrentCorrectionAsValidated(req);
  await applyCorrectionToImage(updatedCorrection);
}

async function markCurrentCorrectionAsValidated(req) {
  return req.correction.update(
    {
      state: "accepted",
      validator_id: req.user.id,
      remark: req.body.remark,
      date_validated: models.sequelize.literal("now()")
    },
    {
      returning: true
    }
  );
}

async function rejectCurrentCorrection(req) {
  return req.correction.update({
    state: "rejected",
    validator_id: req.user.id,
    remark: req.body.remark
  });
}

// Utility functions & middlewares
// ===============================

exports.findCorrection = route(async (req, res, next) => {
  const { include } = getOwnerScope(req);

  const correction = await models.corrections.findOne({
    include,
    where: {
      id: req.params.id
    }
  });

  if (!correction) {
    throw notFoundError(req);
  }

  req.correction = correction;
  next();
});

async function applyCorrectionToImage(correction) {
  const { correction: newValue, image_id, type } = correction;

  // The image property that is updated depends on the type of the correction.
  const valuesToUpdate = {
    [type]: newValue
  };

  await models.images.update(
    valuesToUpdate,
    {
      where: {
        id: image_id
      }
    }
  );
}
