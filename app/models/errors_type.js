module.exports = (sequelize, DataTypes) => {
  const Errors = sequelize.define(
    "errors_type",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true // Automatically gets converted to SERIAL for postgres
      },
      title: {
        // title in english
        type: DataTypes.TEXT,
        allowNull: false
      },
      translations: {
        type: DataTypes.TEXT,
        allowNull: false
      }
    },
    {
      freezeTableName: true // Model tableName will be the same as the model name
    }
  );
  return Errors;
};
