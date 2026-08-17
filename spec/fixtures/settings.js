const { QueryTypes } = require("sequelize");

const { sequelize } = require("../../app/models");
const { get } = require("../utils/fixtures");

/**
 * Inserts a setting into the database. Column values that are not
 * provided will be randomly generated or set to a default value.
 *
 * @param {Object} [properties] - Database column values for the setting.
 * @returns {Object} The inserted row, including its generated ID.
 */
exports.createSetting = async (properties = {}) => {
  const columns = {
    name: get(properties, "name"),
    value: get(properties, "value"),
  };

  const result = await sequelize.query(
    `
      INSERT INTO settings
      (
        name, value
      )
      VALUES (
        :name, :value
      )
      RETURNING id
    `,
    {
      replacements: {
        name: columns.name,
        value: JSON.stringify(columns.value),
      },
      type: QueryTypes.INSERT,
    }
  );

  const rows = result[0];
  const insertedSetting = rows[0];

  return {
    ...columns,
    id: insertedSetting.id,
  };
};
