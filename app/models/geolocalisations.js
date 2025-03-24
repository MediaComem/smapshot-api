module.exports = (sequelize, DataTypes) => {
  const Geolocalisations = sequelize.define(
    "geolocalisations",
    {
      id: {
        // Reference image
        type: DataTypes.INTEGER,
        autoIncrement: true, // Automatically gets converted to SERIAL for postgres
        primaryKey: true
      },
      image_id: {
        // Reference image
        type: DataTypes.INTEGER,
        allowNull: false
      },
      // Geolocalisation
      user_id: {
        // Reference user
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      date_georef: {
        // Date viewing
        type: DataTypes.DATE,
        allowNull: true
      },
      start: {
        type: DataTypes.TIME,
        allowNull: true
      },
      stop: {
        type: DataTypes.TIME,
        allowNull: true
      },
      previous_geolocalisation_id: {
        // Reference user
        type: DataTypes.INTEGER
      },
      // Geolocalisation result
      location: {
        type: "geometry(Point,4326,3)",
        allowNull: true
      },
      footprint: {
        type: "geometry(MultiPolygon,4326,3)", // Z
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
      tilt: {
        type: DataTypes.DOUBLE,
        allowNull: true,
        get() {
          // Workaround until sequelize issue https://github.com/sequelize/sequelize/issues/8019 is fixed
          const value = this.getDataValue('tilt');
          return value === null ? null : parseFloat(value);
        }
      },
      roll: {
        type: DataTypes.DOUBLE,
        allowNull: true,
        get() {
          // Workaround until sequelize issue https://github.com/sequelize/sequelize/issues/8019 is fixed
          const value = this.getDataValue('roll');
          return value === null ? null : parseFloat(value);
        }
      },
      focal: {
        type: DataTypes.DOUBLE,
        allowNull: true,
        get() {
          // Workaround until sequelize issue https://github.com/sequelize/sequelize/issues/8019 is fixed
          const value = this.getDataValue('focal');
          return value === null ? null : parseFloat(value);
        }
      },
      px: {
        // Principal point
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      py: {
        // Principal point
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      gcp_json: {
        // Stores GCP as json
        type: DataTypes.TEXT,
        allowNull: true
      },
      score: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      surface_ratio: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      n_gcp: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      // Validation
      validator_id: {
        // Reference user
        type: DataTypes.INTEGER,
        allowNull: true
      },
      errors_list: {
        //
        type: DataTypes.ARRAY(DataTypes.INTEGER),
        allowNull: true
      },
      remark: {
        //
        type: DataTypes.TEXT,
        allowNull: true
      },
      date_validated: {
        // Date creation
        type: DataTypes.DATEONLY,
        allowNull: true
      },
      date_checked: {
        // Date viewing
        type: DataTypes.DATEONLY,
        allowNull: true
      },
      state: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      region_px: {
        type: DataTypes.ARRAY(DataTypes.INTEGER),
        allowNull: true
      },
      image_modifiers: {
        type: DataTypes
      }
    },
    {
      freezeTableName: true // Model tableName will be the same as the model name
    }
  );

  Geolocalisations.associate = models => {
    Geolocalisations.belongsTo(models.images, {
      foreignKey: "image_id"
    });
    Geolocalisations.belongsTo(models.users, {
      foreignKey: "user_id", as: "volunteer"
    });
    Geolocalisations.belongsTo(models.users, {
      foreignKey: "validator_id", as: "validator"
    });
  };

  return Geolocalisations;
};
