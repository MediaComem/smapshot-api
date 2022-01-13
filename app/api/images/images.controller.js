const WebSocket = require('ws');

const config = require('../../../config');
const models = require("../../models");
const { userHasRole } = require("../../utils/authorization");
const utils = require("../../utils/express");
const { getFieldI18n } = require("../../utils/params");
const { notFoundError, requestBodyValidationError } = require('../../utils/errors');
const { getOwnerScope } = require('./images.utils');
const iiifLevel0Utils = require('../../utils/IIIFLevel0');

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
    'iiif_data',
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
            THEN case 
              WHEN iiif_data->>'size_info' IS NOT NULL
                THEN json_build_object('image_url', NULL,
                                    'tiles', json_build_object('type', 'iiif', 'url', CONCAT(iiif_data->>'image_service3_url', '/info.json')),
                                    'model_3d_url', CONCAT('${config.apiUrl}/data/collections/', collection_id,'/gltf/',images.id,'.gltf'))
                ELSE json_build_object('image_url', CONCAT((iiif_data->>'image_service3_url'), '/full/200,/0/default.jpg'),
                                   'tiles', json_build_object('type', 'iiif', 'url', CONCAT(iiif_data->>'image_service3_url', '/info.json')),
                                   'model_3d_url', CONCAT('${config.apiUrl}/data/collections/', collection_id,'/gltf/',images.id,'.gltf'))
                END
        WHEN iiif_data IS NULL AND (images.state = 'validated' OR images.state = 'waiting_validation')
            THEN json_build_object('image_url',CONCAT('${config.apiUrl}/data/collections/', collection_id,'/images/thumbnails/',images.id,'.jpg'),
                                   'tiles', json_build_object('type', 'dzi', 'url', CONCAT('${config.apiUrl}/data/collections/', collection_id,'/images/tiles/',images.id,'.dzi')),
                                   'model_3d_url', CONCAT('${config.apiUrl}/data/collections/', collection_id,'/gltf/',images.id,'.gltf'))
        WHEN iiif_data IS NOT NULL
            THEN case 
              WHEN iiif_data->>'size_info' IS NOT NULL
                THEN json_build_object('image_url', NULL,
                                  'tiles', json_build_object('type', 'iiif', 'url', CONCAT(iiif_data->>'image_service3_url', '/info.json')))
                ELSE json_build_object('image_url', CONCAT((iiif_data->>'image_service3_url'), '/full/200,/0/default.jpg'),
                                   'tiles', json_build_object('type', 'iiif', 'url', CONCAT(iiif_data->>'image_service3_url', '/info.json')))
                END
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

  // Unpublished images can only be accessed by super administrators and owner administrators.
  if (!userHasRole(req, 'super_admin') && !userHasRole(req, 'owner_admin')) {
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
        attributes: [
          "id",
          [models.Sequelize.literal(`
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
            `),"name"],
          "link"
        ],
        required: false
      }
    ],
    group: ["images.id", "apriori_locations.id", "georeferencer.id", "owner.id", "collection.id",
            "photographer.id", "photographer->images_photographers.image_id", "photographer->images_photographers.photographer_id"],
    where
  });

  if (results === null) {
    throw notFoundError(req);
  }
    
  results.dataValues.photographer.forEach((photographer) => {
    delete photographer.dataValues.images_photographers;
  });
  results.dataValues.photographers = results.dataValues.photographer;
  delete results.dataValues.photographer;

  const iiifLevel0Promise = [];

  const media = results.dataValues.media;
  if (media && media.image_url === null &&
    iiifLevel0Utils.isIIIFLevel0(results.dataValues.iiif_data)) {
    iiifLevel0Promise.push(iiifLevel0Utils.getImageMediaUrl(media, results.dataValues.iiif_data.size_info, 1024));
  }

  await Promise.all(iiifLevel0Promise);

  delete results.dataValues.iiif_data;

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

// POST /images
// ==================

exports.submitImage = utils.route(async (req, res) => {
  
  //CHECKS
  //check image does not exist already
  const existingImage = await models.images.findOne({
    where: {
      original_id: req.body.original_id,
      collection_id: req.body.collection_id
    }
  });

  if (existingImage) {
    throw requestBodyValidationError(req, [
      {
        location: 'body',
        path: '',
        message: req.__('images.submitted.originalIdAlreadyExist'),
        validation: 'imageOriginalIdExist'
      }
    ])
  } 

  //check iiif_data
  if (req.body.iiif_data.regionByPx) {
    const [x,y,w,h] = req.body.iiif_data.regionByPx;
    //tests x + y is < width/height image and w,h is > 0
    const test_xy = x < req.body.width && y < req.body.height;
    const test_wh = w > 0 && h > 0;

    if (!test_xy || !test_wh) {
      throw requestBodyValidationError(req, [
        {
          location: 'body',
          path: '',
          message: req.__('Region parameters not correct.'),
          validation: 'WrongRegionParameters'
        }
      ])
    }
  }

  //check if given photographers already exist and find them
  let req_photographer_ids = req.body.photographer_ids;
  if (!req_photographer_ids || req_photographer_ids.length === 0) {
    req_photographer_ids = [3]; /* anonyme */
  }
  //throw error if no photographer with given id is found
  const res_photographers = await findPhotographers(req, req_photographer_ids)


  //CREATE ATTRIBUTES

  //exact date
  let exact_date_req;
  if (req.body.date_shot) {
    exact_date_req = true;
  } else if (req.body.date_shot_min && req.body.date_shot_max) {
    exact_date_req = false;
  } else {
    //if no date given throw error
    throw requestBodyValidationError(req, [
      {
        location: 'body',
        path: '',
        message: req.__('images.submitted.dateRequired'),
        validation: 'imageDateRequired'
      }
    ])
  }

  //INSERT IMAGE AND APRIORI LOCATION IN DATABASE

  //table images
  const newImage = await models.images.create({
    original_id: req.body.original_id,
    state: req.body.apriori_location.exact ? 'waiting_alignment' : 'initial',
    original_state: req.body.apriori_location.exact ? 'waiting_alignment' : 'initial',
    owner_id: req.collection.owner_id,
    collection_id: req.body.collection_id,
    is_published: req.body.is_published,
    name: req.body.name,
    date_inserted: models.sequelize.literal("current_timestamp"),
    exact_date: exact_date_req,
    iiif_data: {
      image_service3_url: req.body.iiif_data.image_service3_url,
      regionByPx: req.body.iiif_data.regionByPx
    },
    title: req.body.title,
    orig_title: req.body.title,
    caption: req.body.caption,
    orig_caption: req.body.caption,
    license: req.body.license,
    download_link: req.body.download_link,
    link: req.body.link,
    shop_link: req.body.shop_link,
    observation_enabled: req.body.observation_enabled,
    correction_enabled: req.body.correction_enabled,
    view_type: req.body.view_type,
    height: req.body.height,
    width: req.body.width,
    date_orig: req.body.date_orig,
    date_shot: req.body.date_shot,
    date_shot_min: req.body.date_shot_min,
    date_shot_max: req.body.date_shot_max,
    apriori_altitude: req.body.apriori_location.altitude,
  });

  //add association in join table images_photographers
  newImage.addPhotographer(res_photographers);

  //table apriori_location
  const req_apriori_location= req.body.apriori_location;
  const longitude = req_apriori_location.longitude;
  const latitude = req_apriori_location.latitude;
  const altitude = req_apriori_location.altitude ? req_apriori_location.altitude : 1000;
  
  const apriori_location_json = models.sequelize.fn(
    "ST_SetSRID",
    models.sequelize.fn("ST_MakePoint", longitude, latitude, altitude ),
    "4326"
  );

  const newAprioriLocation = await models.apriori_locations.create({
    image_id: newImage.id,
    original_id: newImage.original_id,
    geom: apriori_location_json,
    azimuth: req_apriori_location.azimuth,
    exact: req_apriori_location.exact
  });

  //RESULTS SENT
  const posted_image = newImage.dataValues

  const posted_apriori_location = {
    geom: newAprioriLocation.dataValues.geom, 
    azimuth: parseFloat(newAprioriLocation.dataValues.azimuth),
    exact: newAprioriLocation.dataValues.exact
  }
  posted_image.apriori_location = posted_apriori_location;
  if (posted_image.apriori_altitude) {
    posted_image.apriori_altitude = parseFloat(posted_image.apriori_altitude)
  }

  posted_image.photographers = res_photographers;
  posted_image.geotags_array = null //to not send empty array

  Object.keys(posted_image).forEach((property) => posted_image[property] === null && delete posted_image[property]);

  res.status(201).send(posted_image);
});

// PUT /images/:id/attributes
// ==========================

exports.updateAttributes = utils.route(async (req, res) => {

  //if width/height updated, check if image is already georeferenced
  if (req.image.date_georef && (req.body.width || req.body.height || req.body.iiif_data) ) {

    throw requestBodyValidationError(req, [
      {
        location: 'body',
        path: '',
        message: req.__('Image already georeferenced, iiif link or dimensions can\'t be changed.'),
        validation: 'DimensionsAndIIIFUnmodifiables'
      }
    ])
  }

  //check iiif_data
  if (req.body.iiif_data.regionByPx) {
    const [x,y,w,h] = req.body.iiif_data.regionByPx;
    
    //tests x + y is < width/height image and w,h is > 0
    const imgWidth = req.body.width? req.body.width : req.image.width;
    const imgHeight = req.body.height? req.body.height : req.image.height;
    const test_xy = x < imgWidth && y < imgHeight;
    const test_wh = w > 0 && h > 0;

    if (!test_xy || !test_wh) {
      throw requestBodyValidationError(req, [
        {
          location: 'body',
          path: '',
          message: req.__('Region parameters not correct.'),
          validation: 'WrongRegionParameters'
        }
      ])
    }
  }

  //UPDATE PHOTOGRAPHERS
  let req_photographer_ids = req.body.photographer_ids;
  if (req_photographer_ids && req_photographer_ids.length !== 0) {

    //check if given photographers id exist and throw error if not
    const res_photographers = await findPhotographers(req, req_photographer_ids);

    //delete any old associations in join table images_photographers
    const imgPhotograph = await models.images.findOne({
      where: {
        id: req.image.id
      },
      include: {
        model: models.photographers,
        as: "photographer"
      }
    });
    const oldPhotographers = [...imgPhotograph.dataValues.photographer];
    req.image.removePhotographer(oldPhotographers);

    //add new association in join table images_photographers
    req.image.addPhotographer(res_photographers);
  }

  //UPDATE DATES
  if (req.body.date_shot !== undefined || req.body.date_shot_min !== undefined || req.body.date_shot_max != undefined) {
    
    //check if date_shot OR date_shot_min + max still exist after request
    const new_date_shot = req.body.date_shot !== undefined ? req.body.date_shot : req.image.date_shot;
    const new_date_shot_min = req.body.date_shot_min !== undefined ? req.body.date_shot_min : req.image.date_shot_min;
    const new_date_shot_max = req.body.date_shot_max != undefined ? req.body.date_shot_max : req.image.date_shot_max;
    
    if (!new_date_shot && (!new_date_shot_min || !new_date_shot_max)) {
      throw requestBodyValidationError(req, [
        {
          location: 'body',
          path: '',
          message: req.__('images.submitted.dateRequired'),
          validation: 'imageDateRequired'
        }
      ]);
    }
    //update image
    const exact_date_req = new_date_shot ? true : false;

    await req.image.update({
      exact_date: exact_date_req,
      date_shot: req.body.date_shot,
      date_shot_min: req.body.date_shot_min,
      date_shot_max: req.body.date_shot_max
    });
  }

  //UPDATE A PRIORI LOCATIONS
  if (req.body.apriori_location) {
    const req_apriori_location= req.body.apriori_location;
    const longitude = req_apriori_location.longitude;
    const latitude = req_apriori_location.latitude;
    const altitude = req_apriori_location.altitude ? req_apriori_location.altitude : 0;
    
    const apriori_location_json = models.sequelize.fn(
      "ST_SetSRID",
      models.sequelize.fn("ST_MakePoint", longitude, latitude, altitude ),
      "4326"
    );

    //delete previous a priori locations
    await models.apriori_locations.destroy({
      where: {
        image_id: req.image.id
      }
    });
    
    //create new apriori locations
    await models.apriori_locations.create({
      image_id: req.image.id,
      original_id: req.image.original_id,
      geom: apriori_location_json,
      azimuth: req_apriori_location.azimuth,
      exact: req_apriori_location.exact
    });

    //update image
    await req.image.update({
      apriori_altitude: req_apriori_location.altitude,
      state: req_apriori_location.exact ? 'waiting_alignment' : 'initial',
      original_state: req_apriori_location.exact ? 'waiting_alignment' : 'initial',
    });
  }

  //UPDATE IMAGE OTHER ATTRIBUTES
  await req.image.update({
    is_published: req.body.is_published,
    name: req.body.name,
    iiif_data: req.body.iiif_data ? {
      image_service3_url: req.body.iiif_data.image_service3_url,
      regionByPx: req.body.iiif_data.regionByPx
    } : req.image.iiif_data,
    title: req.body.title,
    orig_title: req.body.title,
    caption: req.body.caption,
    orig_caption: req.body.caption,
    license: req.body.license,
    download_link: req.body.download_link,
    link: req.body.link,
    shop_link: req.body.shop_link,
    observation_enabled: req.body.observation_enabled,
    correction_enabled: req.body.correction_enabled,
    view_type: req.body.view_type,
    height: req.body.height,
    width: req.body.width,
    date_orig: req.body.date_orig
  });

  res.status(200).send({
    message: "Image attributes have been updated."
  });
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

exports.findCollection = utils.route(async (req, res, next) => {
  const { where } = getOwnerScope(req);

  const collection = await models.collections.findOne({
    where: {
      ...where,
      id: req.body.collection_id
    }
  });

  if (!collection) {
    throw notFoundError(req);
  }

  req.collection = collection;
  next();
});


//check if photographers exist and return them if yes when updating or posting images
async function findPhotographers(req, photographer_ids) {
  const photographers = await models.photographers.findAll({
    where: {
      id: photographer_ids
    }
  });

  if ( photographers.length !== photographer_ids.length ) {
    throw requestBodyValidationError(req, [
      {
        location: 'body',
        path: '',
        message: req.__('images.submitted.photographerDoesNotExist'),
        validation: 'imagePhotographerDoesNotExist'
      }
    ]);
  }
  return photographers
}
