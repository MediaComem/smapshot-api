const models = require("../../models");
const { notFoundError, requestBodyValidationError } = require("../../utils/errors");
const { route } = require("../../utils/express");
const { handleForeignKeyConstraintErrors } = require('../../utils/validation');
const { getOwnerScope: getImageOwnerScope } = require('../images/images.utils');

// Foreign key constraint errors that should be serialized as human-readable
// validation errors for the client.
const foreignKeyConstraintErrors = [
  {
    index: 'problems_image_id_fkey',
    property: 'image_id',
    description: 'image'
  },
  {
    index: 'problems_problem_type_id_fkey',
    property: 'problem_type_id',
    description: 'problem type'
  }
];

// The database ID of the problem type indicating that an image's
// geolocalisation is wrong.
const wrongGeolocalisationProblemTypeId = 7;

// POST /problems
// ==============

exports.submit = route(async (req, res) => {
  let imageId = req.body.image_id;
  let title = req.body.title;
  const imageOriginalId = req.body.original_id;
  const problemTypeId = req.body.problem_type_id;

  if (!imageId && !imageOriginalId) {
    throw requestBodyValidationError(req, [
      {
        location: 'body',
        path: '',
        message: req.__('problems.submitted.errorIdRequired'),
        validation: 'problemImageIdRequired'
      }
    ])
  }

  if (imageOriginalId) {
    const image = await models.images.findOne({
      attributes: ['id'],
      where: {
        original_id: imageOriginalId
      }
    });
    imageId = image.id;
  }

  if (!title) {
    const problemType = await models.problems_type.findOne({
      attributes: ['title'],
      where: {
        id: problemTypeId
      }
    });
    title = problemType.title;
  }

  const queryOptions = {
    user_id: req.user.id,
    image_id: imageId,
    problem_type_id: problemTypeId,
    title: title,
    description: req.body.description,
    date_created: models.sequelize.literal("current_timestamp"),
  };

  try {
    await models.problems.create(queryOptions);
  } catch (err) {
    handleForeignKeyConstraintErrors(req, err, foreignKeyConstraintErrors);
    throw err;
  }

  res.status(201).send({ message: req.__('problems.submitted.success') });
});

// PUT /problems/:id/state
// =======================

exports.updateState = route(async (req, res) => {
  const problem = await req.problem.update(
    {
      state: req.body.state
    },
    {
      returning: true
    }
  );

  if (problem.problem_type_id === wrongGeolocalisationProblemTypeId && problem.state === 'validated') {
    await revertWrongImageGeolocalisation(problem.image_id);
  }

  res.status(200).send({
    message: "Problem state was updated."
  });
});

async function revertWrongImageGeolocalisation(id) {
  await models.images.update(
    {
      geolocalisation_id: null,
      state: models.sequelize.literal('original_state')
    },
    {
      where: { id }
    }
  );
}

// DELETE /problems/:id
// ====================

exports.delete = route(async (req, res) => {
  await req.problem.destroy();
  res.sendStatus(204);
});

// Utility functions & middlewares
// ===============================

exports.findProblem = route(async (req, res, next) => {
  const { include } = getOwnerScope(req);

  const problem = await models.problems.findOne({
    include,
    where: {
      id: req.params.id
    }
  });

  if (!problem) {
    throw notFoundError(req);
  }

  req.problem = problem;
  next();
});

/**
 * Returns the query scope that represents corrections accessible by the
 * authenticated user. The user must be either an owner administrator or an
 * owner validator, or a super administrator.
 *
 * @param {express.Request} req - The Express request object.
 * @returns {Object} Includes clauses for a sequelize query.
 */
function getOwnerScope(req) {
  const include = [];

  const user = req.user;
  if (user.hasRole('owner_admin') || user.hasRole('owner_validator')) {
    // An owner administrator or validator can only update corrections on images
    // linked to the same owner.
    const { where } = getImageOwnerScope(req);
    include.push({
      model: models.images,
      attributes: [],
      where
    });
  } else if (!user.isSuperAdmin()) {
    // A super administrator can do anything. Any other user should not reach
    // this point.
    throw new Error(`Cannot determine owner scope for user ${user.id} with unsupported role(s) ${user.roles.join(', ')}`);
  }

  return { include };
}
