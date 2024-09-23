module.exports = (sequelize, DataTypes) => {
  const Stories = sequelize.define(
    "stories",
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
      logo_link: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      description_preview: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      owner_id: {
        type: DataTypes.INTEGER,
      },
    }
  );

  Stories.associate = models => {
    Stories.hasOne(models.owners, { foreignKey: "id" });
    Stories.belongsTo(models.owners, { foreignKey: "owner_id" });
    Stories.hasMany(models.stories_chapters, { foreignKey: "story_id" });
  };


  return Stories;
};
