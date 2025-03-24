const { QueryTypes } = require('sequelize');

const { sequelize } = require('../../app/models');
const { get, getOrGenerate, serialize } = require('../utils/fixtures');
const {  generateRandomLocalizedName } = require('./i18n');

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
exports.createChapter = async (options = {}) => {

  const columns = {
    title: getOrGenerate(options, 'title', generateRandomLocalizedName),
    type: getOrGenerate(options, 'type', generateRandomLocalizedType),
    picture_id: get(options, 'picture_id', null),
    url_media: get(options, 'url_media', null),
    description: get(options, 'description', null),
    zoom: get(options, 'zoom', null),
    story_id: get(options, 'story_id', null),
    indexinstory: get(options, 'indexinstory', null),
    view_custom: get(options, 'view_custom', null),
  };

  try {
    const result = await sequelize.query(
      `
        INSERT INTO stories_chapters(
          title, type, picture_id, url_media, description, zoom, story_id, indexinstory, view_custom
        )
        VALUES (
          :title, :type, :picture_id, :url_media, :description, :zoom, :story_id, :indexinstory, :view_custom
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
  } catch (e) {
    console.log(e);
  }
  
};


const generateRandomLocalizedType = () => {
  const types = ['VIDEO', 'VIDEO-YOUTUBE', 'IMAGE', 'AUDIO'];
  return types[Math.floor(Math.random() * types.length)];
}
