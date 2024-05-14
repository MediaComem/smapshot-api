const { QueryTypes } = require('sequelize');

const { sequelize } = require('../../app/models');
const { chance } = require('../utils/chance');
const { get, getOrGenerate, serialize } = require('../utils/fixtures');
const { generateRandomLocalizedDescription, generateRandomLocalizedName } = require('./i18n');

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
exports.createStory = async (options = {}) => {

  const columns = {
    title: getOrGenerate(options, 'title', generateRandomLocalizedName),
    logo_link: getOrGenerate(options, 'logo_link', () => chance.url({ domain: 'localhost.localdomain' })),
    description_preview: getOrGenerate(options, 'description_preview', generateRandomLocalizedDescription),
    description: get(options, 'description', generateRandomLocalizedDescription),
  };

  const result = await sequelize.query(
    `
      INSERT INTO stories(
        title, logo_link, description_preview, description
      )
      VALUES (
        :title, :logo_link, :description_preview, :description
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
    id: insertedCollection.id
  };
};
