const { QueryTypes } = require("sequelize");

const { sequelize } = require("../../app/models");
const {
  generateRandomLocalizedDescription,
  generateRandomLocalizedName,
  generateRandomLocalizedSentence,
} = require("./i18n");
const { get, getOrGenerate, serialize } = require("../utils/fixtures");

/**
 * Inserts a news into the database. Column values that are not
 * provided will be randomly generated or set to a default value.
 *
 * @param {Object} [properties] - Database column values for the news.
 * @returns {Object} The inserted row, including its generated ID.
 */
exports.createNews = async (properties = {}) => {
  const columns = {
    title: getOrGenerate(properties, "name", generateRandomLocalizedName),
    description: getOrGenerate(
      properties,
      "description",
      generateRandomLocalizedDescription
    ),
    description_preview: getOrGenerate(
      properties,
      "description_preview",
      generateRandomLocalizedSentence
    ),
    img_url: get(properties, "img_url", null),
    img_alt: getOrGenerate(
      properties,
      "img_alt",
      generateRandomLocalizedSentence
    ),
    published_at: get(properties, "published_at", new Date()),
  };

  const result = await sequelize.query(
    `
      INSERT INTO news
      (
        title, description, description_preview, img_url, img_alt, published_at
      )
      VALUES (
        :title, :description, :description_preview, :img_url, :img_alt, :published_at
      )
      RETURNING id
    `,
    {
      replacements: serialize(columns),
      type: QueryTypes.INSERT,
    }
  );

  const rows = result[0];
  const insertedNews = rows[0];

  return {
    ...columns,
    id: insertedNews.id,
  };
};
