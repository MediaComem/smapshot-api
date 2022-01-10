const { QueryTypes } = require('sequelize');

const { sequelize } = require('../../app/models');
const { get } = require('../utils/fixtures');
/**
 * Insert an association between an image and a photographer into the database.
 *
 * @param {Object} [options] - Database column values for the image.
 * @returns {Object} The inserted row. 
 */

exports.createImagesPhotographers = async (options = {}) => {
  
  const image_id = await get(options, 'image_id');
  const photographer_id = await get(options, 'photographer_id');

  const columns = {
    image_id: image_id,
    photographer_id: photographer_id,
  };

  await sequelize.query(
    `
      INSERT INTO images_photographers
      (
        image_id, photographer_id
      )
      VALUES (
        :image_id, :photographer_id
      )
    `,
    {
      replacements: columns,
      type: QueryTypes.INSERT
    }
  );

  return {
    ...columns
  };
};
