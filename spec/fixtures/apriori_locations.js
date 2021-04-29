const { QueryTypes } = require('sequelize');

const { sequelize } = require('../../app/models');
const { get, serialize } = require('../utils/fixtures');

/**
 * Inserts an a priori location into the database.
 *
 * @param {Object} [properties] - Database column values for the location.
 * @returns {Object} The inserted row, including its generated ID.
 */
exports.createAPrioriLocation = async (properties = {}) => {
  let { longitude, latitude } = properties;

  let geom = null;
  if (longitude && latitude) {
    geom = `ST_setSRID(ST_MakePoint(${longitude}, ${latitude}, 0), 4326)`;
  }
  const columns = {
    image_id: get(properties, 'image_id', null),
    original_id: get(properties, 'original_id', null),
    geom: get(properties, 'geom', null),
    azimuth: get(properties, 'azimuth', null),
    exact: get(properties, 'exact', false)
  };

  const result = await sequelize.query(
    `
      INSERT INTO apriori_locations
      (
        image_id, original_id, geom, azimuth, exact
      )
      VALUES (
        :image_id, :original_id, ${geom}, :azimuth, :exact
      )
      RETURNING id
    `,
    {
      replacements: serialize(columns),
      type: QueryTypes.INSERT
    }
  );

  const rows = result[0];
  const insertedOwner = rows[0];

  return {
    ...columns,
    id: insertedOwner.id
  };
};
