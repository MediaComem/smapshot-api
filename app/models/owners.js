module.exports = (sequelize, DataTypes) => {
  const Owners = sequelize.define(
    "owners",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        unique: true
      },
      name: {
        type: DataTypes.STRING
      },
      link: {
        type: DataTypes.STRING
      },
      slug: {
        type: DataTypes.STRING
      },
      description: {
        type: DataTypes.TEXT
      },
      is_published: {
        type: DataTypes.BOOLEAN
      },
      banner_id:{
        type: DataTypes.INTEGER
      }
    },
    {
      freezeTableName: true // Model tableName will be the same as the model name
    }
  );

  Owners.associate = models => {
    Owners.hasMany(models.collections, { foreignKey: "owner_id" });
    Owners.belongsTo(models.images, { foreignKey: "banner_id", as: "banner" });
    Owners.hasOne(models.stories, {foreignKey: 'owner_id'});
  };
  return Owners;
};
