module.exports = (sequelize, DataTypes) => {
    const Errors = sequelize.define(
      "countries",
      {
        ogc_fid: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true // Automatically gets converted to SERIAL for postgres
        },
        name: {
          // title in english
          type: DataTypes.TEXT,
          allowNull: false
        },
        iso_a2: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        wkb_geometry: {
          type: "geometry",
          allowNull: false
        }
      },
      {
        freezeTableName: true // Model tableName will be the same as the model name
      }
    );
    return Errors;
  };
