module.exports = (sequelize, DataTypes) => {
  const Observations = sequelize.define(
    "observations",
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
      user_id: {
        // id of the user
        type: DataTypes.INTEGER,
        allowNull: false
      },
      // Observation
      date_created: {
        // date of submission
        type: DataTypes.DATE,
        allowNull: false
      },
      observation: {
        // modification ot the image caption
        type: DataTypes.TEXT,
        allowNull: false
      },
      coord_x: {
        // image coordinate of the observation
        type: DataTypes.DOUBLE,
        allowNull: true,
        get() {
          // Workaround until sequelize issue https://github.com/sequelize/sequelize/issues/8019 is fixed
          const value = this.getDataValue('coord_x');
          return value === null ? null : parseFloat(value);
        }
      },
      coord_y: {
        // image coordinate of the observation
        type: DataTypes.DOUBLE,
        allowNull: true,
        get() {
          // Workaround until sequelize issue https://github.com/sequelize/sequelize/issues/8019 is fixed
          const value = this.getDataValue('coord_y');
          return value === null ? null : parseFloat(value);
        }
      },
      width: {
        type: DataTypes.DOUBLE,
        allowNull: true,
        get() {
          // Workaround until sequelize issue https://github.com/sequelize/sequelize/issues/8019 is fixed
          const value = this.getDataValue('width');
          return value === null ? null : parseFloat(value);
        }
      },
      height: {
        type: DataTypes.DOUBLE,
        allowNull: true,
        get() {
          // Workaround until sequelize issue https://github.com/sequelize/sequelize/issues/8019 is fixed
          const value = this.getDataValue('height');
          return value === null ? null : parseFloat(value);
        }
      },
      // Validation
      validator_id: {
        // id of the user
        type: DataTypes.INTEGER,
        allowNull: true
      },
      date_validated: {
        // date of the submission
        type: DataTypes.DATE,
        allowNull: true
      },
      remark: {
        // modification ot the image caption
        type: DataTypes.TEXT,
        allowNull: true
      },
      // Download
      downloaded: {
        // if the caption is checked
        type: DataTypes.BOOLEAN,
        allowNull: true
      },
      download_timestamp: {
        // date of the submission
        type: DataTypes.DATE,
        allowNull: true
      },
      state: {
        type: DataTypes.TEXT,
        isIn: [["created", "validated", "rejected"]],
        allowNull: true
      }
    },
    {
      freezeTableName: true // Model tableName will be the same as the model name
    }
  );

  Observations.associate = models => {
    Observations.belongsTo(models.images, {
      foreignKey: "image_id"
    });
    Observations.belongsTo(models.users, {
      foreignKey: "user_id",
      as: "volunteer"
    });
    Observations.belongsTo(models.users, {
      foreignKey: "validator_id",
      as: "validator"
    });
  };

  return Observations;
};
