const WebSocket = require('ws');

const config = require('../../../config');
const models = require("../../models");
const { userHasRole } = require("../../utils/authorization");
const utils = require("../../utils/express");
const { getFieldI18n } = require("../../utils/params");
const { notFoundError } = require('../../utils/errors');
const { getOwnerScope } = require('./images.utils');

// PUT /images/:id/state
// =====================

exports.updateState = utils.route(async (req, res) => {
  let state = req.body.new_state;
  if (state === "not_georef") {
    state = models.sequelize.literal('original_state');
  }

  await req.image.update({
    state,
    is_published: req.body.publish || false
  });

  res.status(200).send({
    message: "Image state was updated."
  });
});

exports.unLockWS = function lock(client, request) {
  client.room = this.setRoom(request);
  utils.getLogger().info(`New client connected to ${client.room}`);

  client.on('message', async(message) => {
    const content = JSON.parse(message);

    if (Number.isInteger(parseInt(content.id, 10))) {
      const result = await models.images.update(
        {
          last_start: null,
          last_start_user_id: null
        },
        {
          where: {
            id: parseInt(content.id, 10)
          }
        }
      );

      if (Array.isArray(result) && result[0] === 0){
        client.send("Not found");
      } else {
        const numberOfRecipients = this.broadcast(client, message);
        utils.getLogger().info(`${client.room} message broadcast to ${numberOfRecipients} recipient${numberOfRecipients === 1 ? '' : 's'}.`);
      }
    } else {
      client.send("Not a int");
    }
  });
}

exports.lockWS = function lock(client, request) {
  client.room = this.setRoom(request);
  utils.getLogger().info(`New client connected to ${client.room}`);

  client.on('message', async(message) => {
    const content = JSON.parse(message);

    if (Number.isInteger(parseInt(content.id, 10))) {
      const result = await models.images.update(
        {
          last_start: models.sequelize.literal("now()"),
          last_start_user_id: parseInt(content.user_id, 10)
        },
        {
          where: {
            id: parseInt(content.id, 10)
          }
        }
      );

      if (Array.isArray(result) && result[0] === 0) {
        client.send("Not found");
      } else {
        const numberOfRecipients = this.broadcast(client, message);
        utils.getLogger().info(`${client.room} message broadcast to ${numberOfRecipients} recipient${numberOfRecipients === 1 ? '' : 's'}.`);
      }
    } else {
      client.send("Not a int");
    }
  });
}

// POST /images/:id/lock
// =====================

exports.lock = utils.route(async (req, res) => {
  // Simulate a call from inside
  const websocketProtocol = config.env === 'production' ? 'wss' : 'ws';
  const lockSocket = new WebSocket(websocketProtocol + '://' + config.apiUrl.replace(/(^\w+:|^)\/\//, '') + '/images/lock');
  lockSocket.addEventListener('open', () => {
    lockSocket.send(JSON.stringify({ id: req.params.id, user_id: req.query.user_id}));
  });
  lockSocket.addEventListener('message', result => {
    if (result.data === 'Not found') {
      throw utils.createApiError("Image not found.", { status: 404 });
    }

    res.status(200).send({
      message: "Image was locked."
    });
    lockSocket.close();
  });
});

// POST /images/:id/unlock
// =======================

exports.unlock = utils.route(async (req, res) => {
  // Simulate a call from inside
const websocketProtocol = config.env === 'production' ? 'wss' : 'ws';
const unLockSocket = new WebSocket(websocketProtocol + '://' + config.apiUrl.replace(/(^\w+:|^)\/\//, '') + '/images/unlock');
  unLockSocket.addEventListener('open', () => {
    unLockSocket.send(req.params.id);
  });
  unLockSocket.addEventListener('message', result => {
    if (result.data === 'Not found') {
      throw utils.createApiError("Image not found.", { status: 404 });
    }

    res.status(200).send({
      message: "Image was unlocked."
    });
    unLockSocket.close();
  });
});

// GET /images/:id/checklock
// =========================

exports.checkLock = utils.route(async (req, res) => {
  const imageId = req.params.imageId;

  const queryPromise = models.images.findOne({
    attributes: [
      [
        models.sequelize.literal(`
          CASE
            WHEN
            (DATE_PART('day', now()::timestamp - last_start::timestamp) * 24 * 60
            + DATE_PART('hour', now()::timestamp - last_start::timestamp) * 60
            + DATE_PART('minute', now()::timestamp - last_start::timestamp)) < 120
            THEN TRUE
            ELSE FALSE
          END
          `),
        "locked"
      ],
      ["last_start_user_id", "user_id"]
    ],
    where: {
      id: imageId
    }
  });

  const result = await queryPromise;
  res.status(200).send(result);
});

// GET /images/:id/attributes
// ==========================

exports.getAttributes = utils.route(async (req, res) => {
  const lang = req.getLocale();

  let attributes = [
    "id",
    "is_published",
    "original_id",
    "title",
    "caption",
    "license",
    "download_link",
    "link",
    "shop_link",
    "observation_enabled",
    "correction_enabled",
    "state",
    "apriori_altitude",
    "view_type",
    "azimuth",
    "tilt",
    "roll",
    "focal",
    'width',
    'height',
    'country_iso_a2',
    [models.sequelize.literal("ST_X(location)"), "longitude"],
    [models.sequelize.literal("ST_Y(location)"), "latitude"],
    [models.sequelize.literal("ST_Z(location)"), "altitude"],
    [
      models.sequelize.literal(
        `(case
          when date_shot IS NOT NULL
          THEN date(date_shot)::TEXT
          else date(date_shot_min)::TEXT
          end)
          `
      ),
      "date_shot_min"
    ],
    [
      models.sequelize.literal(
        `(case
          when date_shot IS NOT NULL
          THEN date(date_shot)::TEXT
          else date(date_shot_max)::TEXT
          end)`
      ),
      "date_shot_max"
    ],
    [models.sequelize.literal("(EXTRACT(EPOCH FROM now())-EXTRACT(EPOCH FROM last_start))/60"), "delta_last_start"],
    [
      models.sequelize.literal(`
          CASE
            WHEN
            (DATE_PART('day', now()::timestamp - last_start::timestamp) * 24 * 60
            + DATE_PART('hour', now()::timestamp - last_start::timestamp) * 60
            + DATE_PART('minute', now()::timestamp - last_start::timestamp)) < 120
            THEN TRUE
            ELSE FALSE
          END
          `),
      "locked"
    ],
    ["last_start_user_id", "locked_user_id"],
    [ models.sequelize.fn("COUNT", models.sequelize.col("observations.*")), "nObs"],
    [
      models.sequelize.literal(
      `(CASE
        WHEN iiif_data IS NOT NULL AND (images.state = 'validated' OR images.state = 'waiting_validation')
            THEN json_build_object('image_url', CONCAT((iiif_data->>'image_service3_url'), '/pct:1,1,99,99/^200,/0/default.jpg'),
                                   'tiles', json_build_object('type', 'iiif', 'url', CONCAT(iiif_data->>'image_service3_url', '/info.json')),
                                   'model_3d_url', CONCAT('${config.apiUrl}/data/collections/', collection_id,'/gltf/',images.id,'.gltf'))
        WHEN iiif_data IS NULL AND (images.state = 'validated' OR images.state = 'waiting_validation')
            THEN json_build_object('image_url',CONCAT('${config.apiUrl}/data/collections/', collection_id,'/images/thumbnails/',images.id,'.jpg'),
                                   'tiles', json_build_object('type', 'dzi', 'url', CONCAT('${config.apiUrl}/data/collections/', collection_id,'/images/tiles/',images.id,'.dzi')),
                                   'model_3d_url', CONCAT('${config.apiUrl}/data/collections/', collection_id,'/gltf/',images.id,'.gltf'))
        WHEN iiif_data IS NOT NULL
            THEN json_build_object('image_url', CONCAT((iiif_data->>'image_service3_url'), '/pct:1,1,99,99/^200,/0/default.jpg'),
                                   'tiles', json_build_object('type', 'iiif', 'url', CONCAT(iiif_data->>'image_service3_url', '/info.json')))
        ELSE
            json_build_object('image_url',CONCAT('${config.apiUrl}/data/collections/', collection_id,'/images/thumbnails/',images.id,'.jpg'),
                              'tiles', json_build_object('type', 'dzi', 'url', CONCAT('${config.apiUrl}/data/collections/', collection_id,'/images/tiles/',images.id,'.dzi')))
        end)`
      ),
      "media"
    ]
  ];

  const where = {
    id: req.params.id
  };

  // Unpublished images can only be accessed by super administrators.
  if (!userHasRole(req, 'super_admin')) {
    where.is_published = true;
  }

  const results = await models.images.findOne({
    attributes: attributes,
    include: [
      {
        model: models.apriori_locations,
        attributes: [
          [models.sequelize.literal("ST_X(geom)"), "longitude"],
          [models.sequelize.literal("ST_Y(geom)"), "latitude"],
          "azimuth",
          "exact"
        ],
        required:false
      },
      {
        model: models.observations,
        attributes: [],
        required: false,
        where: {
          state: "validated"
        }
      },
      {
        model: models.users,
        as: "georeferencer",
        attributes: ["id", "username"],
        required: false
      },
      {
        model: models.owners,
        attributes: ["id", [getFieldI18n('owner', 'name', lang), "name"], "link", "slug"]
      },
      {
        model: models.collections,
        attributes: ["id", [getFieldI18n('collection', 'name', lang), "name"], "link"]
      },
      {
        model: models.photographers,
        as: "photographer",
        attributes: ["id", [
          models.Sequelize.literal(`
            CASE
            WHEN photographer.first_name IS NOT NULL AND photographer.last_name IS NOT NULL AND company IS NOT NULL
            	THEN photographer.first_name || ' ' || photographer.last_name || ', ' || company
            WHEN photographer.first_name IS NOT NULL AND photographer.last_name IS NOT NULL
            	THEN photographer.first_name || ' ' || photographer.last_name
            WHEN photographer.last_name IS NOT NULL AND photographer.company IS NOT NULL
              THEN photographer.last_name || ', ' || photographer.company
            WHEN photographer.first_name IS NOT NULL
            	THEN photographer.first_name
            WHEN photographer.last_name IS NOT NULL
            	THEN photographer.last_name
            WHEN photographer.company IS NOT NULL
            	THEN photographer.company
            ELSE 'unknown'
            END
            `), "name"], "link"]
      }
    ],
    group: ["images.id", "apriori_locations.id", "georeferencer.id", "owner.id", "collection.id", "photographer.id"],
    where
  });

  if (results === null) {
    throw notFoundError(req);
  }

  // Group POSE attributes.
  const {
    caption,
    altitude,
    latitude,
    longitude,
    azimuth,
    tilt,
    roll,
    focal,
    country_iso_a2,
    ...partialObject
  } = results.toJSON();

  res.status(200).send({
    ...partialObject,
    caption,
    pose: { altitude, latitude, longitude, azimuth, tilt, roll, focal, country_iso_a2 }
  });
});

// GET /images/:id/footprint
// =========================

exports.getFootprint = utils.route(async (req, res) => {
  const queryPromise = models.images.findOne({
    attributes: [[models.sequelize.literal(
      `
      CASE
        WHEN viewshed_simple IS NOT NULL
        THEN ST_AsGeoJson(viewshed_simple, 5, 2)
        WHEN viewshed_simple IS NULL
        THEN ST_AsGeoJson(footprint, 5, 2)
        ELSE NULL
      END::json
      `
    ), "footprint"]],
    where: {
      id: req.params.id
    },
  });
  const result = await queryPromise;
  res.status(200).send(result);
});

// Utility functions & middlewares
// ===============================

exports.findImage = utils.route(async (req, res, next) => {
  const { where } = getOwnerScope(req);

  const image = await models.images.findOne({
    where: {
      ...where,
      id: req.params.id
    }
  });

  if (!image) {
    throw notFoundError(req);
  }

  req.image = image;
  next();
});
