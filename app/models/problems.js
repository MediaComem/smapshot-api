module.exports = (sequelize, DataTypes) => {
  const Problems = sequelize.define(
    "problems",
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
        type: DataTypes.INTEGER,
        allowNull: false
      },
      date_created: {
        // date of submission
        type: DataTypes.DATE,
        allowNull: false
      },
      problem_type_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      title: {
        // validation
        type: DataTypes.TEXT,
        allowNull: true
      },
      description: {
        // validation
        type: DataTypes.TEXT,
        allowNull: true
      },
      validator_id: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      state: {
        type: DataTypes.TEXT,
        isIn: [["created", "validated", "owner_processed", "admin_processed"]],
        allowNull: true,
      }
    },
    {
      freezeTableName: true // Model tableName will be the same as the model name
    }
  );

  Problems.associate = models => {
    Problems.belongsTo(models.problems_type, {
      foreignKey: "problem_type_id"
    });
    Problems.belongsTo(models.images, {
      foreignKey: "image_id"
    });
    Problems.belongsTo(models.users, {
      foreignKey: "user_id"
    });
    Problems.belongsTo(models.users, {
      foreignKey: "user_id",
      as: "volunteer"
    });
    Problems.belongsTo(models.users, {
      foreignKey: "validator_id",
      as: "validator"
    });
  };

  return Problems;
};
