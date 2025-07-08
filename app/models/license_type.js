module.exports = (sequelize, DataTypes) => {
  const LicenseType = sequelize.define(
    "license_type",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true // Automatically gets converted to SERIAL for postgres
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      code: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      url: {
        type: DataTypes.TEXT,
        allowNull: true
      }
    },
    {
      freezeTableName: true // Model tableName will be the same as the model name
    }
  );

  LicenseType.associate = models => {
    LicenseType.hasMany(models.images, { foreignKey: "license_type_id" });
  };


  return LicenseType;
};
