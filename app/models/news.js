module.exports = (sequelize, DataTypes) => {
  const News = sequelize.define(
    "news",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        unique: true,
      },
      title: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      description: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      description_preview: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      img_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      img_alt: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      freezeTableName: true, // Model tableName will be the same as the model name
    }
  );

  return News;
};
