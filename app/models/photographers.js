module.exports = (sequelize, DataTypes) => {
  const Photographers = sequelize.define(
    "photographers",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        autoIncrement: true, // Automatically gets converted to SERIAL for postgres
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

  Photographers.associate = models => {
    Photographers.belongsToMany(models.images, { through: 'images_photographers', as: 'images', foreignKey: 'photographer_id' });
  };

  return Photographers;
};
