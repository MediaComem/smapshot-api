module.exports = (sequelize, DataTypes) => {
  const imagesViews = sequelize.define(
    "images_views",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        autoIncrement: true, // Automatically gets converted to SERIAL for postgres
        unique: true
      },
      image_id: {
        // id of the image
        type: DataTypes.INTEGER,
        allowNull: false
      },
      date: {
        // date of visualisation
        type: DataTypes.DATE,
        allowNull: false
      },
      viewer_type: {
        // 2D or 3D
        type: DataTypes.TEXT,
        allowNull: false
      },
      viewer_origin: {
        // georeferencer or visit
        type: DataTypes.TEXT,
        allowNull: false
      }
    },
    {
      freezeTableName: true // Model tableName will be the same as the model name
    }
  );

  imagesViews.associate = models => {
    imagesViews.belongsTo(models.images, { foreignKey: "image_id" });
  };

  return imagesViews;
};
