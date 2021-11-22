const bcrypt = require("bcrypt");

const config = require('../../config');

module.exports = (sequelize, DataTypes) => {
  const Users = sequelize.define(
    "users",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        unique: true
      },
      email: {
        type: DataTypes.STRING,
        validate: {
          isEmail: true
        },
        unique: true
      },
      first_name: {
        type: DataTypes.STRING
      },
      last_name: {
        type: DataTypes.STRING
      },
      password: {
        type: DataTypes.STRING
      },
      username: {
        type: DataTypes.STRING,
        unique: false
      },
      googleid: {
        // Provided by Google
        type: DataTypes.STRING,
        unique: true
      },
      facebookid: {
        // Provided by Facebook
        type: DataTypes.STRING,
        unique: true
      },
      letter: {
        // If they want the newsletter
        defaultValue: false,
        type: DataTypes.BOOLEAN
      },
      nimages: {
        // Number of images (not in use)
        type: DataTypes.INTEGER
      },
      date_registr: {
        defaultValue: sequelize.literal("current_timestamp"),
        type: DataTypes.DATE
      },
      has_one_validated: {
        type: DataTypes.BOOLEAN,
        allowNull: true
      },
      lang: {
        type: DataTypes.STRING,
        allowNull: true
      },
      roles: {
        // can modify and validate geolocation
        defaultValue: ["volunteer"],
        isIn: [["volunteer", "super_admin", "owner_admin", "owner_validator"]],
        type: DataTypes.ARRAY(DataTypes.TEXT),
        allowNull: true
      },
      owner_id: {
        // can modify and validate geolocation
        type: DataTypes.INTEGER,
        allowNull: true
      },
      reset_password_token: {
        type: DataTypes.STRING
      },
      reset_password_expires: {
        type: DataTypes.DATE
      },
      // Account has been activated with the confirmation link
      active:{
        type: DataTypes.BOOLEAN,
      },
      active_token: {
        type: DataTypes.STRING
      },
      active_expires: {
        type: DataTypes.DATE
      },
      last_login: {
        type: DataTypes.DATE
      },
    },
    {
      hooks: {
        // Async is recommend by bcrypt: https://github.com/kelektiv/node.bcrypt.js#why-is-async-mode-recommended-over-sync-mode
        beforeCreate: async user => {
          if (user.password) {
            const salt = await bcrypt.genSalt(config.bcryptRounds);
            user.password = await bcrypt.hash(user.password, salt, null); // eslint-disable-line
          }
        },
        beforeUpdate: async user => {
          if (user.password) {
            const salt = await bcrypt.genSalt(config.bcryptRounds);
            user.password = await bcrypt.hash(user.password, salt, null); // eslint-disable-line
          }
        }
      }
    }
  );

  Users.prototype.hasRole = function hasRole(role) {
    return this.roles.includes(role);
  };

  Users.prototype.isSuperAdmin = function isSuperAdmin() {
    return this.hasRole('super_admin');
  };

  Users.prototype.isOwnerAdmin = function isOwnerAdmin() {
    return this.hasRole('owner_admin');
  };

  Users.prototype.isOwnerValidator = function isOwnerValidator() {
    return this.hasRole('owner_validator');
  };

  Users.prototype.validPassword = function compare(password) {
    return bcrypt.compare(password, this.password);
  };

  Users.associate = models => {
    Users.belongsTo(models.owners, {
      foreignKey: "owner_id"
    });
    Users.hasMany(models.images, {
      foreignKey: "user_id"
    });
    Users.hasMany(models.geolocalisations, {
      foreignKey: "user_id"
    });
    Users.hasMany(models.observations, {
      foreignKey: "user_id"
    });
    Users.hasMany(models.corrections, {
      foreignKey: "user_id"
    });
  };

  return Users;
};
