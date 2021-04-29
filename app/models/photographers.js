module.exports = (sequelize, DataTypes) => {
  const Photographers = sequelize.define(
    "photographers",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        unique: true
      },
      first_name: {
        type: DataTypes.STRING
      },
      last_name: {
        type: DataTypes.STRING
      },
      link: {
        type: DataTypes.STRING
      },
      company: {
        type: DataTypes.STRING
      }
    },
    {
      freezeTableName: true // Model tableName will be the same as the model name
    }
  );

  return Photographers;
};
