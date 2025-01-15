module.exports = (sequelize, DataTypes) => {
  const Images = sequelize.define(
    "images",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true // Automatically gets converted to SERIAL for postgres
      },
      // Relations
      collection_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      owner_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      user_id: {
        // User
        type: DataTypes.INTEGER,
        allowNull: true
      },
      validator_id: {
        // User who validate the image
        type: DataTypes.INTEGER,
        allowNull: true
      },
      geolocalisation_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      // image ID
      original_id: {
        // identifier provided by the owner
        type: DataTypes.TEXT,
        allowNull: true
      },
      link_id: {
        // original identifier which links the metadata with the image file
        type: DataTypes.TEXT,
        allowNull: true
      },
      // images metadata
      name: {
        // Name of the image
        type: DataTypes.STRING,
        allowNull: true
      },
      date_shot: {
        // Date of the photography
        type: DataTypes.DATE,
        allowNull: true
      },
      title: {
        // Image title
        type: DataTypes.TEXT,
        allowNull: true
      },
      orig_title: {
        // Original image title
        type: DataTypes.TEXT,
        allowNull: true
      },
      caption: {
        // Image caption
        type: DataTypes.TEXT,
        allowNull: true
      },
      orig_caption: {
        // Original image caption
        type: DataTypes.TEXT,
        allowNull: true
      },
      license: {
        // which license
        type: DataTypes.TEXT,
        allowNull: true
      },
      link: {
        // image link
        type: DataTypes.TEXT,
        allowNull: true
      },
      download_link: {
        // link for the downlaod
        type: DataTypes.TEXT,
        allowNull: true
      },
      shop_link: {
        // link for the shop
        type: DataTypes.TEXT,
        allowNull: true
      },
      date_orig: {
        // Date of the photography in text format provided by the owner
        type: DataTypes.TEXT,
        allowNull: true
      },
      exact_date: {
        // date is exact or is an interval
        type: DataTypes.BOOLEAN,
        allowNull: false
      },
      date_shot_min: {
        // if interval: minimum date
        type: DataTypes.DATEONLY,
        allowNull: true
      },
      date_shot_max: {
        // if interval: maximum date
        type: DataTypes.DATEONLY,
        allowNull: true
      },
      apriori_altitude: {
        // Apriori height above ground?
        type: DataTypes.DOUBLE,
        allowNull: true,
        get() {
          // Workaround until sequelize issue https://github.com/sequelize/sequelize/issues/8019 is fixed
          const value = this.getDataValue('apriori_altitude');
          return value === null ? null : parseFloat(value);
        }
      },
      view_type: {
        // type of view (terrestrial, nadir, low_oblique, high_oblique)
        type: DataTypes.TEXT,
        allowNull: true
      },
      height: {
        // Apriori height above ground?
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      width: {
        // Apriori height above ground?
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      // Corrections
      correction_enabled: {
        // surface_score user
        type: DataTypes.BOOLEAN,
        allowNull: true
      },
      // Observations
      observation_enabled: {
        // surface_score user
        type: DataTypes.BOOLEAN,
        allowNull: true
      },
      // Publication
      date_inserted: {
        // date of insertion
        type: DataTypes.DATE,
        allowNull: true
      },
      is_published: {
        type: DataTypes.BOOLEAN,
        allowNull: false
      },
      date_georef: {
        type: DataTypes.DATEONLY,
        allowNull: true
      },
      location: {
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
        // focal
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
      // Lock
      last_start: {
        // date of the submission
        type: DataTypes.DATE,
        allowNull: true
      },
      // Lock
      last_start_user_id:{
        type: DataTypes.INTEGER,
        allowNull: true
      },
      date_validated: {
        type: DataTypes.DATE,
        allowNull: true
      },
      footprint: {
        type: "geometry(Multipolygon,4326,2)", // Z
        allowNull: true
      },
      // Computed metadata
      geotags_array: {
        // Only one of those is used to strore the place name and search
        type: "text[]"
      },
      geotag_created: {
        // if the caption is checked
        type: DataTypes.BOOLEAN,
        allowNull: true
      },
      geotag_timestamp: {
        // date of the submission
        type: DataTypes.DATE,
        allowNull: true
      },
      geotags_json: {
        // link for the downlaod
        type: DataTypes.TEXT,
        allowNull: true
      },
      viewshed_simple: {
        type: "geometry(Multipolygon,4326,2)", // Z
        allowNull: true
      },
      viewshed_created: {
        // if the caption is checked
        type: DataTypes.BOOLEAN,
        allowNull: true
      },
      viewshed_timestamp: {
        // date of the submission
        type: DataTypes.DATE,
        allowNull: true
      },
      // metadata download
      downloaded: {
        type: DataTypes.BOOLEAN,
        allowNull: true
      },
      download_timestamp: {
        type: DataTypes.DATE,
        allowNull: true
      },
      state: {
        type: DataTypes.TEXT
      },
      original_state: {
        type: DataTypes.TEXT,
        defaultValue: 'initial'
      },
      iiif_data: {
        type: DataTypes
      },
      framing_mode: {
        // type of framing_mode (single_image, composite_image)
        type: DataTypes.TEXT,
        allowNull: false
      },
      image_modifiers: {
        type: DataTypes
      }
    },
    {
      freezeTableName: true // Model tableName will be the same as the model name
    }
  );

  Images.associate = models => {
    Images.belongsTo(models.owners, { foreignKey: "owner_id" });
    Images.belongsTo(models.collections, { foreignKey: "collection_id" });
    Images.belongsToMany(models.photographers, { through: 'images_photographers', as: 'photographer', foreignKey: 'image_id' }); 
    Images.hasMany(models.apriori_locations, { foreignKey: "image_id" });
    Images.hasMany(models.observations, { foreignKey: "image_id" });
    Images.hasMany(models.images_views, { foreignKey: "image_id", as: "views" });
    Images.belongsTo(models.geolocalisations, { foreignKey: "geolocalisation_id" });
    Images.belongsTo(models.users, { foreignKey: "user_id", as: "georeferencer" });
    Images.hasOne(models.geometadata, { foreignKey: "fk_image_id" });
    Images.hasOne(models.stories_chapters, {foreignKey: 'picture_id'});
  };

  return Images;
};
