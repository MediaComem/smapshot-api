module.exports = (sequelize, DataTypes) => {
  const Apriori_locations = sequelize.define(
    "apriori_locations",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true // Automatically gets converted to SERIAL for postgres
      },
      image_id: {
        type: DataTypes.INTEGER
      },
      original_id: {
        // identifier provided by the owner
        type: DataTypes.TEXT,
        allowNull: true
      },
      geom: {
        type: "geometry(Point,4326,3)",
        allowNull: true
      },
      azimuth: {
        type: DataTypes.DECIMAL,
        allowNull: true,
        get() {
          // Workaround until sequelize issue https://github.com/sequelize/sequelize/issues/8019 is fixed
          const value = this.getDataValue('azimuth');
          return value === null ? null : parseFloat(value);
        }
      },
      exact: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
    },
    {
      freezeTableName: true // Model tableName will be the same as the model name
    }
  );

  Apriori_locations.associate = models => {
    Apriori_locations.belongsTo(models.images, { foreignKey: "image_id" });
  };

  return Apriori_locations;
};
