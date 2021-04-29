const { without, pick } = require('lodash');
const { QueryTypes } = require('sequelize');

const { sequelize } = require('../../app/models');
const { chance } = require('../utils/chance');
const { get, getOrGenerate, getOrGenerateAssociation, serialize } = require('../utils/fixtures');
const { createImage } = require('./images');
const { createUser } = require('./users');

const correctionStates = [ 'created', 'accepted', 'updated', 'rejected' ];
const correctionTypes = [ 'caption', 'title' ];

/**
 * Inserts a correction into the database. Column values that are not provided
 * will be randomly generated or set to a default value.
 *
 * The following associated resources may be automatically generated as well:
 *
 * * The image being corrected (unless provided with `image_id` or `image`).
 * * The user who made the correction (unless provided with `user_id` or
 *   `user`).
 * * If the state is "accepted", "updated" or "rejected", the validator who
 *   changed the state (unless provided with `validator_id` or `validator`).
 *
 * Note that if a correction is in the "updated" state, there is supposed to be
 * another correction which links to the first one as its previous version.
 * This function does not handle that case automatically. Calling it with no
 * options will generate a random state which is never "updated". To generate an
 * "updated" correction, you have to manually set the state to "updated" and
 * generate the associated correction yourself.
 *
 * @param {Object} [options] - Database column values for the collection.
 * @returns {Object} The inserted row, including its generated ID. Additionally,
 * the `image`, `user` and `validator` properties may include the associated
 * fixtures which were automatically generated.
 */
exports.createCorrection = async (options = {}) => {

  const downloaded = get(options, 'downloaded', false);

  // Generate a random state but never "updated".
  const state = getOrGenerate(options, 'state', () => chance.pickone(without(correctionStates, 'updated')));
  // ensure image options are consistent with correction options
  options.image = { ...pick(options, "collection", "collection_id", "owner", "owner_id"), ...options.image, state: 'initial'};
  const { image, image_id } = await getOrGenerateAssociation(options, createImage, 'image');
  const { user, user_id } = await getOrGenerateAssociation(options, createUser, 'user');
  const { validator, validator_id } = await getOrGenerateAssociation(options, createUser, {
    association: 'validator',
    // Automatically create an associated validator by default if the state
    // requires it.
    required: options.validator !== false && [ 'accepted', 'updated', 'rejected' ].includes(state)
  });

  const columns = {
    image_id,
    user_id,
    type: getOrGenerate(options, 'type', () => chance.pickone(correctionTypes)),
    correction: getOrGenerate(options, 'correction', () => chance.sentence()),
    date_created: getOrGenerate(options, 'date_created', () => new Date()),
    validator_id,
    date_validated: getOrGenerate(options, 'date_validated', () => validator_id ? new Date() : null),
    remark: getOrGenerate(options, 'remark', () => chance.sentence()),
    downloaded,
    download_timestamp: getOrGenerate(options, 'download_timestamp', () => new Date()),
    is_original: get(options, 'is_original', false),
    previous_correction_id: get(options, 'previous_correction_id', null),
    state
  };

  const result = await sequelize.query(
    `
      INSERT INTO corrections
      (
        image_id, user_id, type, correction, date_created,
        validator_id, date_validated, remark,
        downloaded, download_timestamp, is_original, state,
        previous_correction_id
      )
      VALUES (
        :image_id, :user_id, :type, :correction, :date_created,
        :validator_id, :date_validated, :remark,
        :downloaded, :download_timestamp, :is_original, :state,
        :previous_correction_id
      )
      RETURNING id
    `,
    {
      replacements: serialize(columns),
      type: QueryTypes.INSERT
    }
  );

  const rows = result[0];
  const insertedCorrection = rows[0];

  return {
    ...columns,
    image,
    user,
    validator,
    id: insertedCorrection.id
  };
};
