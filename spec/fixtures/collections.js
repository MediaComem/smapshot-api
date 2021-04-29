const { QueryTypes } = require('sequelize');

const { sequelize } = require('../../app/models');
const { chance } = require('../utils/chance');
const { get, getOrGenerate, getOrGenerateAssociation, serialize } = require('../utils/fixtures');
const { generateRandomLocalizedDescription, generateRandomLocalizedName } = require('./i18n');
const { createOwner } = require('./owners');

/**
 * Inserts an image collection into the database. Column values that are not
 * provided will be randomly generated or set to a default value.
 *
 * The collection is empty, i.e. no associated images are generated. If no owner
 * is provided, one is randomly generated unless provided with `owner_id` or
 * `owner`.
 *
 * @param {Object} [options] - Database column values for the collection.
 * @returns {Object} The inserted row, including its generated ID. Additionally,
 * the `owner` property includes the associated fixture.
 */
exports.createCollection = async (options = {}) => {

  const { owner, owner_id } = await getOrGenerateAssociation(options, createOwner, 'owner');

  const columns = {
    owner_id,
    name: getOrGenerate(options, 'name', generateRandomLocalizedName),
    link: getOrGenerate(options, 'link', () => chance.url({ domain: 'localhost.localdomain' })),
    description: getOrGenerate(options, 'description', generateRandomLocalizedDescription),
    is_owner_challenge: get(options, 'is_owner_challenge', false),
    date_publi: getOrGenerate(options, 'date_publi', () => new Date()),
    banner_id: get(options, 'banner_id', null),
    is_main_challenge: get(options, 'is_main_challenge', false)
  };

  const result = await sequelize.query(
    `
      INSERT INTO collections
      (
        name, owner_id, link, description, is_owner_challenge,
        date_publi, banner_id, is_main_challenge
      )
      VALUES (
        :name, :owner_id, :link, :description, :is_owner_challenge,
        :date_publi, :banner_id, :is_main_challenge
      )
      RETURNING id
    `,
    {
      replacements: serialize(columns),
      type: QueryTypes.INSERT
    }
  );

  const rows = result[0];
  const insertedCollection = rows[0];

  return {
    ...columns,
    owner,
    id: insertedCollection.id
  };
};

/**
 * Sets the banner of a collection.
 *
 * This function mutates the collection object.
 *
 * @param {Object} collection - The collection to update.
 * @param {Object} image - The image to use as the collection's banner.
 * @returns {Promise} A promise that will be resolved with the updated
 * collection.
 */
exports.updateCollectionBanner = async (collection, { id: banner_id }) => {

  const { id } = collection;
  await sequelize.query(
    'UPDATE collections SET banner_id = :banner_id WHERE id = :id;',
    {
      replacements: { banner_id, id },
      type: QueryTypes.UPDATE
    }
  )

  collection.banner_id = banner_id;
  return collection;
};
