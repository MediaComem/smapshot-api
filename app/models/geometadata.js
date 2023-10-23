module.exports = (sequelize, DataTypes) => {
  const Geometadata = sequelize.define(
    "geometadata",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true, // Automatically gets converted to SERIAL for postgres
      },
      fk_image_id:{
        type: DataTypes.INTEGER,
        allowNull: true
      },
      footprint: {
        type: "geometry",
        allowNull: true
      },
      viewshed_simple: {
        type: "geometry",
        allowNull: true
      },
      toponyms_array: {
        type: "text[]"
      },
      toponyms_json: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      footprint_status: {
        type: DataTypes.TEXT,
      },
      viewshed_simple_status: {
        type: DataTypes.TEXT,
      },
      toponyms_status: {
        type: DataTypes.TEXT,
      },
      footprint_timestamp: {
        type: DataTypes.DATE,
      },
      viewshed_simple_timestamp: {
        type: DataTypes.DATE,
      },
      toponyms_timestamp: {
        type: DataTypes.DATE,
      },
      viewshed_git_revision_hash: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      toponyms_iterations: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      toponyms_count: {
        type: "numeric[]",
        allowNull: true
      },
      toponyms_factors: {
        type: "numeric[]",
        allowNull: true
      },
      toponyms_git_revision_hash: {
        type: DataTypes.TEXT,
        allowNull: true
      },
    },
    {
      freezeTableName: true // Model tableName will be the same as the model name
    }
  );

  Geometadata.associate = models => {
    Geometadata.belongsTo(models.images, { foreignKey: "fk_image_id"});
  };

  return Geometadata;
};
