const { without, pick } = require('lodash');
const { QueryTypes } = require('sequelize');

const { sequelize } = require('../../app/models');
const { chance } = require('../utils/chance');
const { get, getOrGenerate, getOrGenerateAssociation, serialize } = require('../utils/fixtures');
const { createImage } = require('./images');
const { createUser } = require('./users');

const geolocalisationStates = [ 'created', 'waiting_validation', 'validated', 'improved', 'rejected' ];

/**
 * Inserts a geolocalisation of an image into the database. Column values that
 * are not provided will be randomly generated or set to a default value.
 *
 * The following associated resources may be automatically generated as well:
 *
 * * The image being geolocated (unless provided with `image_id` or `image`).
 * * The user who located the image (unless provided with `user_id` or `user`).
 * * If the state is "validated", "improved" or "rejected", the validator who
 *   changed the state (unless provided with `validator_id` or `validator`).
 *
 * Note that if a geolocalisation is in the "improved" state, there is supposed
 * to be another geolocalisation which links to the first one as its previous
 * version. This function does not handle that case automatically. Calling it
 * with no options will generate a random state which is never "improved". To
 * generate an "improved" geolocalisation, you have to manually set the state to
 * "improved" and generate the associated geolocalisation yourself.
 *
 * @param {Object} [options] - Database column values for the collection.
 * @returns {Object} The inserted row, including its generated ID. Additionally,
 * the `image`, `user` and `validator` properties may include the associated
 * fixtures which were automatically generated.
 */
exports.createGeolocalisation = async (options = {}) => {

  // Generate a random state, but never "improved".
  const state = getOrGenerate(options, 'state', () => chance.pickone(without(geolocalisationStates, 'improved')));
  // ensure image options are consistent with geolocation options
  options.image = { ...pick(options, "collection", "collection_id", "owner", "owner_id", "user", "user_id"), ...options.image, state: imageState(state)};
  const { image, image_id } = await getOrGenerateAssociation(options, createImage, 'image');
  const { user, user_id } = await getOrGenerateAssociation(options, createUser, 'user');
  const { validator, validator_id } = await getOrGenerateAssociation(options, createUser, {
    association: 'validator',
    // Automatically create an associated validator by default if the state
    // requires it.
    required: options.validator !== false && [ 'validated', 'improved', 'rejected' ].includes(state)
  });

  const columns = {
    image_id,
    user_id,
    errors_list: get(options, 'errors_list', []),
    remark: getOrGenerate(options, 'remark', () => chance.sentence()),
    date_seen: getOrGenerate(options, 'date_seen', () => new Date()),
    date_georef: getOrGenerate(options, 'date_georef', () => new Date()),
    start: get(options, 'start', null),
    stop: get(options, 'stop', null),
    gcp_json: get(options, 'gcp_json', null),
    location: get(options, 'location', null),
    azimuth: get(options, 'azimuth', null),
    tilt: get(options, 'tilt', null),
    roll: get(options, 'roll', null),
    focal: get(options, 'focal', null),
    px: get(options, 'px', null),
    py: get(options, 'py', null),
    score: get(options, 'score', null),
    surface_ratio: get(options, 'surface_ratio', null),
    n_gcp: get(options, 'n_gcp', null),
    date_checked: get(options, 'date_checked', null),
    footprint: get(options, 'footprint', null),
    validator_id,
    date_validated: getOrGenerate(options, 'date_validated', () => validator_id ? new Date() : null),
    previous_geolocalisation_id: get(options, 'previous_geolocalisation_id', null),
    state
  };

  const result = await sequelize.query(
    `
      INSERT INTO geolocalisations
      (
        image_id, user_id, errors_list, remark, date_seen, date_georef,
        start, stop, gcp_json, location, azimuth, tilt, roll, focal,
        px, py, score, surface_ratio, n_gcp, date_checked, footprint,
        validator_id, date_validated, previous_geolocalisation_id, state
      )
      VALUES (
        :image_id, :user_id, array[:errors_list]::integer[], :remark, :date_seen, :date_georef,
        :start, :stop, :gcp_json, :location, :azimuth, :tilt, :roll, :focal,
        :px, :py, :score, :surface_ratio, :n_gcp, :date_checked, :footprint,
        :validator_id, :date_validated, :previous_geolocalisation_id, :state
      )
      RETURNING id
    `,
    {
      replacements: serialize(columns),
      type: QueryTypes.INSERT
    }
  );

  const rows = result[0];
  const insertedGeolocalisation = rows[0];

  return {
    ...columns,
    image,
    user,
    validator,
    id: insertedGeolocalisation.id
  };
};

/**
 * Get the image state to be consistent with geolocation.
 *
 * @param {string} state - The state of the linked geolocation.
 * @returns {string} The corresponding image state
 * image.
 */
const imageState = (geoState) => {
  switch (geoState) {
    case 'validated':
      return 'validated';
    case 'rejected':
      return 'initial'
    case 'waiting_validation':
      return 'waiting_validation';
  }
  return 'initial';
};
