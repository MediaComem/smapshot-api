const { pick } = require('lodash');
const { QueryTypes } = require('sequelize');

const { sequelize } = require('../../app/models');
const { chance } = require('../utils/chance');
const { get, getOrGenerate, getOrGenerateAssociation, serialize } = require('../utils/fixtures');
const { createImage } = require('./images');
const { createUser } = require('./users');

const observationStates = [ 'created', 'validated', 'rejected' ];

/**
 * Inserts an observation into the database. Column values that are not provided
 * will be randomly generated or set to a default value.
 *
 * The following associated resources may be automatically generated as well:
 *
 * * The image that is the subject of the observation (unless provided with
 *   `image_id` or `image`).
 * * The user who made the observation (unless provided with `user_id` or
 *   `user`).
 * * If the state is "accepted" or "rejected", the validator who changed the
 *   state (unless provided with `validator_id` or `validator`).
 *
 * @param {Object} [options] - Database column values for the collection.
 * @returns {Object} The inserted row, including its generated ID. Additionally,
 * the `image`, `user` and `validator` properties may include the associated
 * fixtures which were automatically generated.
 */
exports.createObservation = async (options = {}) => {

  const downloaded = get(options, 'downloaded', false);
  const state = getOrGenerate(options, 'state', () => chance.pickone(observationStates));
  // ensure image options are consistent with observation options
  options.image = { ...pick(options, "collection", "collection_id", "owner", "owner_id"), ...options.image, state: 'initial'};
  const { image, image_id } = await getOrGenerateAssociation(options, createImage, 'image');
  const { user, user_id } = await getOrGenerateAssociation(options, createUser, 'user');
  const { validator, validator_id } = await getOrGenerateAssociation(options, createUser, {
    association: 'validator',
    // Automatically create an associated validator by default if the state
    // requires it.
    required: options.validator !== false && [ 'accepted', 'rejected', 'validated' ].includes(state)
  });

  const columns = {
    image_id,
    user_id,
    date_created: getOrGenerate(options, 'date_created', () => new Date()),
    observation: getOrGenerate(options, 'observation', () => chance.sentence()),
    coord_x: getOrGenerate(options, 'coord_x', () => chance.integer({ min: -180, max: 180 })),
    coord_y: getOrGenerate(options, 'coord_y', () => chance.integer({ min: -180, max: 180 })),
    remark: getOrGenerate(options, 'remark', () => chance.sentence()),
    width: getOrGenerate(options, 'width', () => chance.floating({ min: 0, max: 1 })),
    height: getOrGenerate(options, 'height', () => chance.floating({ min: 0, max: 1 })),
    validator_id,
    date_validated: getOrGenerate(options, 'date_validated', () => validator_id ? new Date() : null),
    downloaded,
    download_timestamp: getOrGenerate(options, 'download_timestamp', () => new Date()),
    state
  };

  const result = await sequelize.query(
    `
      INSERT INTO observations
      (
        image_id, user_id, date_created, observation, coord_x, coord_y,
        remark, width, height, validator_id, date_validated,
        downloaded, download_timestamp, state
      )
      VALUES (
        :image_id, :user_id, :date_created, :observation, :coord_x, :coord_y,
        :remark, :width, :height, :validator_id, :date_validated,
        :downloaded, :download_timestamp, :state
      )
      RETURNING id
    `,
    {
      replacements: serialize(columns),
      type: QueryTypes.INSERT
    }
  );

  const rows = result[0];
  const insertedObservation = rows[0];

  return {
    ...columns,
    image,
    user,
    validator,
    id: insertedObservation.id
  };
};
