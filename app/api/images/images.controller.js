const WebSocket = require('ws');
const Sequelize = require("sequelize");

const config = require('../../../config');
const models = require("../../models");
const { userHasRole } = require("../../utils/authorization");
const utils = require("../../utils/express");
const { getFieldI18n } = require("../../utils/params");
const { notFoundError, requestBodyValidationError, poseEstimationError } = require('../../utils/errors');
const { getOwnerScope } = require('./images.utils');
const mediaUtils = require('../../utils/media');
const pose = require("../pose-estimation/pose-estimation.controller");

const Op = Sequelize.Op;

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
  const image_width = req.query.image_width ? parseInt(req.query.image_width) : 200;
  const image_id = req.params.id;

  const today = new Date();
  today.setHours(23);
  today.setMinutes(59);

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
    'framing_mode',
    [models.sequelize.literal("ST_X(images.location)"), "longitude"],
    [models.sequelize.literal("ST_Y(images.location)"), "latitude"],
    [models.sequelize.literal("ST_Z(images.location)"), "altitude"],
    [
      models.sequelize.literal(
        `(CASE
          WHEN date_shot IS NOT NULL
          THEN date(date_shot)::TEXT
          ELSE date(date_shot_min)::TEXT
          END)
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
    [ models.sequelize.fn("COUNT", models.sequelize.col("observations.*")), "nObs"]
  ];

  const where = {
    id: image_id
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
        attributes: ["id", [getFieldI18n('collection', 'name', lang), "name"], "link", "date_publi"],
        where: {
          date_publi: {
            [Op.not]: null,
            [Op.lte]: today // future publish date is not yet published
          },
        }
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
      },
      {
        model: models.geolocalisations, //used to build media.model_3d_url. If composite_image, the model_3d_url corresponds to the geolocalisation registered in the images table.
        attributes: ["id","region_px"],
        required: false
      }
    ],
    group: ["images.id", "apriori_locations.id", "georeferencer.id", "owner.id", "collection.id",
            "photographer.id", "photographer->images_photographers.image_id", "photographer->images_photographers.photographer_id",
            "geolocalisation.user_id", "geolocalisation.id", "geolocalisation.image_id"],
    where
  });

  if (results === null) {
    throw notFoundError(req);
  }
  
  //clean results for photographers
  results.dataValues.photographer.forEach((photographer) => {
    delete photographer.dataValues.images_photographers;
  });
  results.dataValues.photographers = results.dataValues.photographer;
  delete results.dataValues.photographer;

  //collection_id
  const collection_id = results.dataValues.collection.dataValues.id;

  //GROUP POSES attributes.
  //If composite_image, get all validated and waiting_validation poses from geolocalisations table.
  if (results.dataValues.framing_mode === 'composite_image') {
    const res_geolocs = await models.geolocalisations.findAll({
      attributes: [
        "id", "image_id", "state", "region_px", "azimuth", "tilt", "roll", "focal",
        [models.sequelize.literal("ST_X(location)"), "longitude"],
        [models.sequelize.literal("ST_Y(location)"), "latitude"],
        [models.sequelize.literal("ST_Z(location)"), "altitude"]
      ],
      where: {
        image_id: req.params.id,
        state: {
          [Op.or]: ['validated','waiting_validation']
        }
      }
    });
  
    let poses = [];
    for (const geoloc of res_geolocs) {
      const region = geoloc.dataValues.region_px ? geoloc.dataValues.region_px : null;
      const pose = {
        geolocalisation_id: geoloc.dataValues.id,
        image_id: image_id,
        state: geoloc.dataValues.state,
        regionByPx: geoloc.dataValues.region_px,
        gltf_url: mediaUtils.generateGltfUrl(image_id, collection_id, region),
        altitude: geoloc.dataValues.altitude,
        latitude: geoloc.dataValues.latitude,
        longitude: geoloc.dataValues.longitude,
        azimuth: parseFloat(geoloc.dataValues.azimuth),
        tilt: parseFloat(geoloc.dataValues.tilt),
        roll: parseFloat(geoloc.dataValues.roll),
        focal: parseFloat(geoloc.dataValues.focal)
      };
      poses.push(pose);
    }
    results.dataValues.poses = poses;
  }

  //GROUP POSE attributes.
  //Geolocalisation registered in the images table.
  //If composite_image, corresponds to the last geolocalisation having been saved (geolocalisations/{id}/save).

  // Build gltf_url for pose
  let gltf_url = null;
  let region_px = null;
  let geoloc_id = null;
  if (results.dataValues.geolocalisation) {
    region_px =  results.dataValues.geolocalisation.region_px;
    geoloc_id = results.dataValues.geolocalisation.id;
    gltf_url = mediaUtils.generateGltfUrl(image_id, collection_id, region_px);
  } else if (collection_id === 12) {
    // swisstopo pre-georeferenced images
    gltf_url = mediaUtils.generateGltfUrl(image_id, collection_id, region_px);
  }


  //BUILD MEDIA
  const image = results.dataValues;
  image.collection_id = collection_id;
  image.media = {};

  const geoloc_region = image.geolocalisation ? image.geolocalisation.dataValues.region_px : null;

  //set image_url on media and generate tiles
  await mediaUtils.setImageUrl(image, image_width, /* image_height */ null);
  image.media.tiles = mediaUtils.generateImageTiles(image_id, collection_id, image.iiif_data);

  //if image georeferenced, generate model_3d_url
  if (image.state === 'validated' || image.state ==='waiting_validation') {
    image.media.model_3d_url = mediaUtils.generateGltfUrl(image_id, collection_id, geoloc_region);
  }

  //iiif_data region
  if (image.iiif_data && image.iiif_data.regionByPx) {
    image.media.regionByPx = image.iiif_data.regionByPx;
  }

  delete results.dataValues.iiif_data;
  delete results.dataValues.collection_id;
  delete results.dataValues.geolocalisation;


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
    pose: { altitude, latitude, longitude, azimuth, tilt, roll, focal, country_iso_a2, geolocalisation_id: geoloc_id, regionByPx: region_px, gltf_url }
  });
});

// GET /images/:id/geopose
// =========================

// Convenience function for computing the GeoPose of an image
function mod(n, m) {
  return ((n % m) + m) % m;
}

exports.getGeoPose = utils.route(async (req, res) => {
  const queryPromise = models.images.findOne({
    attributes: [
      "id",
      "state",
      "azimuth",
      "tilt",
      "roll",
      [models.sequelize.literal("ST_X(location)"), "lon"],
      [models.sequelize.literal("ST_Y(location)"), "lat"],
      [models.sequelize.literal("ST_Z(location)"), "h"],
    ],
    where: {
      id: req.params.id,
      state: {
        [Op.or]: ['validated','waiting_validation']
      }
    }
  });
  const query = await queryPromise;
  const result = query.toJSON();
  const geopose = {
    "position": {
      "lon": result.lon,
      "lat": result.lat,
      "h": result.h,
    },
    "angles": {
      "yaw": mod(360 - result.azimuth, 360),
      "pitch": result.tilt,
      "roll": result.roll,
    },
  }
  res.status(200).send(geopose);
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
    //conditions for recomputing correctly: cropping dimensions must be inside the original dimensions of the image
    const test_maxWidthHeight = x + w <= req.body.width && y + h <= req.body.height;

    if (!test_xy || !test_wh || !test_maxWidthHeight) {
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


  //INSERT IMAGE AND APRIORI LOCATION IN DATABASE

  //table images
  const newImage = await models.images.create({
    original_id: req.body.original_id,
    state: req.body.apriori_location.exact ? 'waiting_alignment' : 'initial',
    original_state: req.body.apriori_location.exact ? 'waiting_alignment' : 'initial',
    owner_id: req.collection.owner_id,
    collection_id: req.body.collection_id,
    is_published: req.body.is_published,
    date_inserted: models.sequelize.literal("current_timestamp"),
    iiif_data: {
      image_service3_url: req.body.iiif_data.image_service3_url,
      regionByPx: req.body.iiif_data.regionByPx
    },
    framing_mode: req.body.framing_mode ? req.body.framing_mode : 'single_image',
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
    exact_date: req.body.date_shot ? true : false,
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
  //If image is already georeferenced: does not allow to update width, height, apriori_locations, iiif_data.image_service3_url or framing_mode.
  const isGeoreferenced = req.image.state === 'waiting_validation' || req.image.state === 'validated';
  const IsDimensionsUpdated = Boolean(req.body.width || req.body.height);
  const IsAprioriLocationUpdated = Boolean(req.body.apriori_location);
  const imageOriginalUrl = req.image.iiif_data ? req.image.iiif_data.image_service3_url : null;
  const isIIIFImageUrlUpdated = Boolean(req.body.iiif_data && !(req.body.iiif_data.image_service3_url === imageOriginalUrl));
  const isFramingModeUpdated = Boolean(req.body.framing_mode);

  if ( isGeoreferenced && (IsDimensionsUpdated || IsAprioriLocationUpdated || isIIIFImageUrlUpdated || isFramingModeUpdated) ) {
    throw requestBodyValidationError(req, [
      {
        location: 'body',
        path: '',
        message: req.__('Image already georeferenced, iiif image url, framing_mode, apriori_locations or dimensions can\'t be updated.'),
        validation: 'DimensionsAndIIIFUnmodifiables'
      }
    ])
  }

  //check iiif_data
  const regionByPx = req.body.iiif_data ? req.body.iiif_data.regionByPx : undefined;
  if (regionByPx) {
    const [x,y,w,h] = regionByPx;
    
    //tests x + y is < width/height image and w,h is > 0
    const imgWidth = req.body.width? req.body.width : req.image.width;
    const imgHeight = req.body.height? req.body.height : req.image.height;
    const test_xy = x < imgWidth && y < imgHeight;
    const test_wh = w > 0 && h > 0;

    //conditions for recomputing correctly: cropping dimensions must be inside the original dimensions of the image
    const test_maxWidthHeight = x + w <= imgWidth && y + h <= imgHeight;

    if (!test_xy || !test_wh || !test_maxWidthHeight) {
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

  //UPDATE A PRIORI LOCATIONS
  if (req.body.apriori_location) {
    const req_apriori_location= req.body.apriori_location;
    const longitude = req_apriori_location.longitude;
    const latitude = req_apriori_location.latitude;
    const altitude = req_apriori_location.altitude ? req_apriori_location.altitude : 1000;

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

  //exact_date
  //if date_shot is sent in the request, take the new value. Else, keep the value stored in the DB.
  const date_shot = req.body.date_shot !== undefined ? req.body.date_shot : req.image.date_shot;
  const exact_date_req = date_shot ? true : false;

  //UPDATE IMAGE OTHER ATTRIBUTES
  await req.image.update({
    is_published: req.body.is_published,
    iiif_data: req.body.iiif_data ? {
      image_service3_url: req.body.iiif_data.image_service3_url,
      regionByPx: req.body.iiif_data.regionByPx
    } : req.image.iiif_data,
    framing_mode: req.body.framing_mode,
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
    exact_date: exact_date_req,
    date_shot: date_shot,
    date_shot_min: req.body.date_shot_min,
    date_shot_max: req.body.date_shot_max
  });

  //RECOMPUTE POSE
  //if image is already geolocalised and new iiif_data, recompute pose
  //if single_image, use region from iiif_data.
  //if composite_image, do not regenerate the gltfs.
  if (isGeoreferenced && req.body.iiif_data) {
    // check if composite image (more than one geolocalisations)
    const res_geolocs = await models.geolocalisations.findAll({
      attributes: ["id"],
      where: {
        image_id: req.image.id,
        state: 'validated'
      }
    });
    if (res_geolocs.length > 1) {
      // do not regenerate the gltfs
      return  res.status(200).send({
        message: "Image attributes have been updated."
      });
    }
    // fetch original gcps calculated on full image (no offset due to cropping) stored in database
    const oldGCPs = req.image.geolocalisation.gcp_json;
    let newGCPsOffset;
    let imageDimensions;

    //if new region, recompute new GCP offsets
    if (regionByPx) {
      imageDimensions = regionByPx; 
      newGCPsOffset = oldGCPs.map( gcp => {
        return {
          ...gcp,
          x: gcp.x-regionByPx[0],
          xReproj: gcp.xReproj-regionByPx[0],
          y: gcp.y-regionByPx[1],
          yReproj: gcp.yReproj-regionByPx[1]
        };
      });
    } else if (!regionByPx) {
      //if region removed, recompute with old original gcps
      imageDimensions = [0,0, req.image.width, req.image.height]; 
      newGCPsOffset = oldGCPs;
    }
    try {
      await pose.computePoseNewCrop(req, req.image.id, newGCPsOffset, imageDimensions);
    } catch {
      throw poseEstimationError(req, req.__('pose.3dModelCreationError'));
    }
  }

  res.status(200).send({
    message: "Image attributes have been updated."
  });
});


// Utility functions & middlewares
// ===============================

exports.findImage = utils.route(async (req, res, next) => {
  const { where } = getOwnerScope(req);

  const image = await models.images.findOne({
    include: [
      {
        model: models.geolocalisations,
        attributes: [
          "gcp_json"
        ],
        required:false
      }
    ],
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

