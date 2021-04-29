module.exports = (sequelize, DataTypes) => {
  const Collections = sequelize.define(
    "collections",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        unique: true
      },
      name: {
        type: DataTypes.STRING
      },
      owner_id: {
        type: DataTypes.INTEGER
      },
      link: {
        type: DataTypes.STRING
      },
      date_publi: {
        type: DataTypes.DATEONLY
      },
      banner_id:{
        type: DataTypes.INTEGER
      },
      is_owner_challenge: {
        // Collection is in highlight in the owner page
        type: DataTypes.BOOLEAN
      },
      is_main_challenge: {
        // Collection is in highlight in the home page
        type: DataTypes.BOOLEAN
      },
      description: {
        type: DataTypes.TEXT
      }
    },
    {
      freezeTableName: true // Model tableName will be the same as the model name
    }
  );

  Collections.associate = models => {
    Collections.hasMany(models.images, { foreignKey: "collection_id" });
    Collections.hasMany(models.images, { foreignKey: "collection_id", as: "georeferenced_images", scope: { state: [ "waiting_validation", "validated" ] } });
    Collections.belongsTo(models.images, { foreignKey: "banner_id", as: "banner" });
    Collections.belongsTo(models.owners, { foreignKey: "owner_id" });
  };

  return Collections;
};
