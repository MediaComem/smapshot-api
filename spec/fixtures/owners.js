const { QueryTypes } = require('sequelize');

const { sequelize } = require('../../app/models');
const { chance } = require('../utils/chance');
const { generateRandomLocalizedDescription, generateRandomLocalizedName } = require('./i18n');
const { get, getOrGenerate, serialize } = require('../utils/fixtures');

/**
 * Inserts an owner of collections into the database. Column values that are not
 * provided will be randomly generated or set to a default value.
 *
 * @param {Object} [properties] - Database column values for the owner.
 * @returns {Object} The inserted row, including its generated ID.
 */
exports.createOwner = async (properties = {}) => {

  const columns = {
    name: getOrGenerate(properties, 'name', generateRandomLocalizedName),
    link: getOrGenerate(properties, 'link', () => chance.url({ domain: 'localhost.localdomain' })),
    slug: getOrGenerate(properties, 'slug', () => chance.syllable()),
    description: getOrGenerate(properties, 'description', generateRandomLocalizedDescription),
    is_published: get(properties, 'is_published', false),
    banner_id: get(properties, 'banner_id', null),
    extent: getOrGenerate(properties, 'extent', generateRandomExtent)
  };

  const result = await sequelize.query(
    `
      INSERT INTO owners
      (
        name, link, slug, description, is_published,
        banner_id, extent
      )
      VALUES (
        :name, :link, :slug, :description, :is_published,
        :banner_id, array[:extent]
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

function generateRandomExtent() {
  const [ minLat, maxLat ] = [ generateRandomLatitude(), generateRandomLatitude() ].sort((a, b) => a - b);
  const [ minLon, maxLon ] = [ generateRandomLongitude(), generateRandomLongitude() ].sort((a, b) => a - b);
  return [ minLon, minLat, maxLon, maxLat ];
}

function generateRandomLatitude() {
  return chance.floating({ min: -90, max: 90 });
}

function generateRandomLongitude() {
  return chance.floating({ min: -180, max: 180 });
}
/**
 * Sets the banner of a owner.
 *
 * This function mutates the owner object.
 *
 * @param {Object} collection - The owner to update.
 * @param {Object} image - The image to use as the owner's banner.
 * @returns {Promise} A promise that will be resolved with the updated
 * owner.
 */
exports.updateOwnerBanner = async (owner, { collection_id: banner_col_id, id: banner_id }) => {

  const { id } = owner;
  await sequelize.query(
    'UPDATE owners SET banner_id = :banner_id WHERE id = :id;',
    {
      replacements: { banner_id, id },
      type: QueryTypes.UPDATE
    }
  )

  owner.banner_col_id = banner_col_id; // keep collection in object to ease check of banner media url
  owner.banner_id = banner_id;
  return owner;
};
