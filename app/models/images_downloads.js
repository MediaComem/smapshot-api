module.exports = (sequelize, DataTypes) => {
  const ImagesDownloads = sequelize.define(
    "images_downloads",
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
      }
    },
    {
      freezeTableName: true // Model tableName will be the same as the model name
    }
  );
  return ImagesDownloads;
};
