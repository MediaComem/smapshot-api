module.exports = (sequelize, DataTypes) => {
    const Chapters = sequelize.define(
      "Stories_chapters",
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
        type: {
          type: DataTypes.TEXT,
          allowNull: false,
          enum: ['VIDEO', 'VIDEO-YOUTUBE', 'IMAGE', 'AUDIO']
        },
        picture_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        url_media: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        zoom: {
            type: DataTypes.INTEGER,
            allowNull: false,
            minimum: 0,
            maximum: 22
        },
        story:{
          type: DataTypes.INTEGER,
          allowNull: false,
          minimum: 0
        },
        indexinstory:{
          type: DataTypes.INTEGER,
          allowNull: false,
          minimum: 0,
          field: 'indexinstory'
        }
      }
    );

    Chapters.associate = models => {
      Chapters.hasMany(models.images, { foreignKey: "id" });
    };

    return Chapters;
  };
  

