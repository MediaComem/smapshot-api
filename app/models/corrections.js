module.exports = (sequelize, DataTypes) => {
  const Corrections = sequelize.define(
    "corrections",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true // Automatically gets converted to SERIAL for postgres
      },
      image_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      user_id: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      // corrections
      previous_correction_id: {
        type: DataTypes.INTEGER
      },
      correction: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      type: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      date_created: {
        type: DataTypes.DATE,
        allowNull: false
      },
      // validation
      validator_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      state: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      date_validated: {
        type: DataTypes.DATE,
        allowNull: true
      },
      remark: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      // download
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
      // original values
      is_original: {
        // date of the submission
        type: DataTypes.BOOLEAN,
        allowNull: true
      }
    },
    {
      freezeTableName: true // Model tableName will be the same as the model name
    }
  );

  Corrections.associate = models => {
    Corrections.belongsTo(models.images, {
      foreignKey: "image_id"
    });
    Corrections.belongsTo(models.users, {
      foreignKey: "user_id",
      as: "volunteer"
    });
    Corrections.belongsTo(models.users, {
      foreignKey: "validator_id",
      as: "validator"
    });
    Corrections.belongsTo(models.corrections, {
      foreignKey: "previous_correction_id",
      as: "previous"
    });
    Corrections.hasOne(models.corrections, {
      foreignKey: "previous_correction_id",
      as: "update"
    });
  };

  return Corrections;
};
