const turfHelpers = require("@turf/helpers");
const turf = require("@turf/turf");

const models = require("../../models");
const { route, getLogger } = require("../../utils/express");
const { notFoundError, requestBodyValidationError, authorizationError } = require('../../utils/errors');
const { getOwnerScope } = require('./geolocalisations.utils');
const { userHasRole  } = require("../../utils/authorization");
const { parseBooleanQueryParam } = require("../../utils/params");
const { apiUrl } = require('../../../config');

exports.getAttributes = route(async (req, res) => {
  const geoloc_id = req.params.id;

  let attributes = [
    "id",
    "image_id",
    "user_id",
    "date_georef",
    "gcp_json",
    "azimuth",
    "tilt",
    "roll",
    "focal",
    [models.sequelize.literal("ST_X(geolocalisations.location)"), "longitude"],
    [models.sequelize.literal("ST_Y(geolocalisations.location)"), "latitude"],
    [models.sequelize.literal("ST_Z(geolocalisations.location)"), "altitude"],
    "region_px"
  ];

  const results = await models.geolocalisations.findOne({
    attributes,
    include: [
      {
        model: models.users,
        as: 'volunteer',
        attributes: ['username']
      },
      {
        model: models.images,
        attributes: ['collection_id']
      }
    ],
    where: {
      id: geoloc_id
    }
  });

  if (results === null) {
    throw notFoundError(req);
  }

  // Build gltf_url
  let region_url = "";
  if (results.dataValues.region_px) {
    region_url = `_${results.dataValues.region_px[0]}_${results.dataValues.region_px[1]}_${results.dataValues.region_px[2]}_${results.dataValues.region_px[3]}`;
  }
  const gltf_url = `${apiUrl}/data/collections/${results.dataValues.image.dataValues.collection_id}/gltf/${results.dataValues.image_id}${region_url}.gltf`;
  delete results.dataValues.image;

  // Group POSE attributs
  const {
    altitude,
    latitude,
    longitude,
    azimuth,
    tilt,
    roll,
    focal,
    region_px,
    ...partialObject
  } = results.toJSON();

  res.status(200).send({
    ...partialObject,
    pose: { altitude, latitude, longitude, azimuth, tilt, roll, focal, regionByPx: region_px, gltf_url } 
  });
});

// user_id 14 reserved for Anonymous volunteers
exports.start = route(async (req, res) => {
  const image_id = req.body.image_id;
  const user_id = req.user ? req.user.id : 14;
  const validator_id = req.body.validator_id;
  const previous_geoloc_id = req.body.previous_geoloc_id;
  const results = await models.geolocalisations.create({
    start: models.sequelize.literal("now()"),
    user_id: user_id,
    validator_id: validator_id,
    image_id: image_id,
    previous_geolocalisation_id: previous_geoloc_id
  });
  
  getLogger(req).log("START", image_id, user_id, validator_id, previous_geoloc_id);

  res.status(201).send(results);
});

exports.save = route(async (req, res) => {
  // Grab data from http request
  const geoloc_id = req.params.id;
  const data = req.body;
  const image_id = data.image_id;
  const longitude = data.longitude;
  const latitude = data.latitude;
  const altitude = data.altitude;
  const roll = data.roll;
  const tilt = data.tilt;
  const azimuth = data.azimuth;
  const focal = data.focal;
  const px = data.cx;
  const py = data.cy;
  const user_id = req.user ? req.user.id : 14;
  const gcps = data.gcps;
  const nGCP = Object.keys(gcps).length;
  const regionByPx = data.regionByPx;
  const framing_mode = data.framing_mode;
  // Parameters for improvement
  const validation_mode = parseBooleanQueryParam(data.validation_mode, false);
  const validator_id = data.validator_id;
  const previous_geoloc_id = data.previous_geoloc_id;
  const remark = data.remark;
  const errors_list = data.errors_list;

  let georeferencer_id = user_id; // in case of improvements, should be the original georeferencer id (l127)

  // Improvments only permitted by authorized users
  if (validation_mode && !userHasRole(req, "owner_admin", "owner_validator")) {
    throw authorizationError(req.__('general.accessForbidden'));
  }

  // Check owner scope for improvments only
  if(validation_mode) {
    const { include } = getOwnerScope(req);
    const geolocalisation = await models.geolocalisations.findOne({
      include,
      where: {
        id: previous_geoloc_id
      }
    });
    if (!geolocalisation) {
      throw notFoundError(req);
    }
    georeferencer_id = geolocalisation.user_id;
  }

  // Max error must be extracted from gcps
  let maxerror = null;
  maxerror = Math.max.apply(Math, gcps.map(function getMax(o) { return o.errorPct; }))


  // Surface ratio must be extracted from gcps and image width and height
  const image = await models.images.findOne({
    attributes: ['height', 'width'],
    where: {
      id: image_id
    },
  });
  let surfaceRatio = null;
  const listPoints = gcps.map(gcp => turfHelpers.point([gcp.x, gcp.y]));

  const bbox = turf.bbox(turfHelpers.featureCollection(listPoints));
  const areaBbox = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]);
  // Compute the image surface
  const areaImage = image.width * image.height;
  // Compute the ratio of the surface
  surfaceRatio = Math.round((areaBbox / areaImage) * 100);

  //for composite_image, the multiple geolocalisations are saved one after the other in the front-end. The last one will be the one also saved in the table images.
  await models.images.update(
    {
      location: models.sequelize.fn(
        "ST_SetSRID",
        models.sequelize.fn("ST_MakePoint", longitude, latitude, altitude),
        "4326"
      ),
      roll: roll,
      tilt: tilt,
      azimuth: azimuth,
      focal: focal,
      px: px,
      py: py,
      user_id: georeferencer_id,
      date_georef: models.sequelize.literal("now()"),
      geolocalisation_id: geoloc_id,
      state: "waiting_validation",
      framing_mode: framing_mode
    },
    {
      where: { id: image_id }
    }
  );
  // Owner scope already checked for validation_mode
  if (validation_mode) {
    await models.images.update(
      {
        date_validated: models.sequelize.literal("now()"),
        state: "validated"
      },
      {
        where: { id: image_id }
      }
    );
  }

  // store the geolocalisation parameters
  await models.geolocalisations.update(
    {
      location: models.sequelize.fn(
        "ST_SetSRID",
        models.sequelize.fn("ST_MakePoint", longitude, latitude, altitude),
        "4326"
      ),
      roll: roll,
      tilt: tilt,
      azimuth: azimuth,
      focal: focal,
      px: px,
      py: py,
      gcp_json: JSON.stringify(gcps),
      score: maxerror,
      surface_ratio: surfaceRatio,
      n_gcp: nGCP,
      previous_geolocalisation_id: null,
      stop: models.sequelize.literal("now()"),
      user_id: georeferencer_id,
      state: "waiting_validation",
      date_checked: models.sequelize.literal("now()"),
      date_georef: models.sequelize.literal("now()"),
      region_px: regionByPx
    },
    {
      where: { id: geoloc_id }
    }
  );

  // if it is an improvement, the geolocalisation is directly validated
  // Owner scope already checked for validation_mode
  if (validation_mode) {
    // update previous geolocalisation
    await models.geolocalisations.update(
      {
        state: "validated",
        validator_id: validator_id,
        previous_geolocalisation_id: previous_geoloc_id
      },
      {
        where: { id: geoloc_id }
      }
    );

    // The geolocalisation is recorded in the image
    const query = `
    UPDATE images SET
    location = g.location,
    roll = g.roll,
    tilt = g.tilt,
    azimuth = g.azimuth,
    focal = g.focal,
    px = g.px,
    py = g.py,
    footprint = ST_Multi(g.footprint)
    FROM geolocalisations g
    WHERE images.geolocalisation_id = g.id
    AND images.id = ${image_id}
    `;
    await models.sequelize.query(query, {
      type: models.sequelize.QueryTypes.SELECT
    });
  }
  // if it is an improvement: the previous geolocalisation is marked as "improved",
  // the reason of the improvement are recorded
  // Owner scope already checked for validation_mode
  if (validation_mode) {
    // update previous geolocalisation
    await models.geolocalisations.update(
      {
        state: "improved",
        remark: remark,
        errors_list: errors_list
      },
      {
        where: { id: previous_geoloc_id }
      }
    );
  }
  // return result
  return res.json({ success: true, message: "Orientation is updated" });
});

let validate = async (req, res) => {
  const geoloc_id = req.geolocalisation.id;
  const validator_id = req.user.id;

  await models.images.update(
    {
      state: "validated",
      validator_id: validator_id,
      date_validated: models.sequelize.literal("now()")
    },
    {
      where: { geolocalisation_id: geoloc_id }
    }
  );

  // The geolocalisation is recorded in the image
  const query = `
  UPDATE images SET
  location = g.location,
  roll = g.roll,
  tilt = g.tilt,
  azimuth = g.azimuth,
  focal = g.focal,
  px = g.px,
  py = g.py,
  footprint = ST_Multi(g.footprint)
  FROM geolocalisations g
  WHERE images.geolocalisation_id = g.id
  AND g.id = ${geoloc_id}
  `;
  await models.sequelize.query(query, {
    type: models.sequelize.QueryTypes.SELECT
  });

  await models.geolocalisations.update(
    {
      validator_id: validator_id,
      state: "validated",
      date_validated: models.sequelize.literal("now()"),
      date_checked: models.sequelize.literal("now()")
    },
    {
      where: { id: geoloc_id }
    }
  );
  return res.json("Geolocalisation is validated");
};

let reject = async (req, res) => {
  const geoloc_id = req.geolocalisation.id;
  const validator_id = req.user.id;
  const errors_list = req.body.errors_list;
  const remark = req.body.remark;

  await models.images.update(
    {
      geolocalisation_id: null,
      state: models.sequelize.literal('original_state'),
      user_id: null,
      location: null,
      roll: null,
      tilt: null,
      azimuth: null,
      focal: null,
      px: null,
      py:null,
      footprint: null
    },
    {
      where: {
        geolocalisation_id: geoloc_id
      }
    }
  );

  await models.geolocalisations.update(
    {
      validator_id: validator_id,
      state: "rejected",
      date_checked: models.sequelize.literal("now()"),
      errors_list: errors_list,
      remark: remark
    },
    {
      where: { id: geoloc_id }
    }
  );

  return res.json("Geolocalisation is rejected");
};

exports.validateOrReject = async (req, res) => {
  const state = req.body.state;
  switch (state) {
    case "validated":
      return validate(req, res);
    case "rejected":
      return reject(req, res);
  }
  res.status(400).send({ success: false, message: "Invalid state" });
};

exports.saveFootprint = route(async (req, res) => {
  const geoloc_id = req.params.id;
  const footprint_geojson = JSON.stringify(req.body.footprint_geojson);
  const longitude = req.body.longitude;
  const latitude = req.body.latitude;
  //Does geoloc_id exist in the DB
  const geolocalisationEntry = await models.geolocalisations.findByPk(geoloc_id);
  if (!geolocalisationEntry){
    throw notFoundError(req);
  }
  //Check if footprint already exists for geoloc_id
  const footPrintExist = geolocalisationEntry.footprint;
  if (footPrintExist){
    throw requestBodyValidationError(req);
  }
  // The footprint computed by cesium is cliped by a radius of 60km around the image location
  await models.geolocalisations.update(
    {
      footprint: models.sequelize.fn(
        "ST_Multi",
        models.sequelize.cast(
          models.sequelize.fn(
            "ST_Intersection",
            // GeometryA
            models.sequelize.fn(
              "ST_Simplify",
              models.sequelize.fn(
                "ST_MakePolygon",
                models.sequelize.fn(
                  "ST_Force2D",
                  models.sequelize.fn("ST_GeomFromGeoJSON", footprint_geojson)
                )
              ),
              0.0001
            ),
            // GeometryB
            models.sequelize.fn(
              "ST_buffer",
              models.sequelize.fn(
                "ST_SetSRID",
                models.sequelize.cast(
                  models.sequelize.fn("ST_MakePoint", longitude, latitude),
                  "geography"
                ),
                "4326"
              ),
              60000
            )
          ),
          "geometry"
        )
      )
    },
    {
      where: { id: geoloc_id }
    }
  );
  return res.json({ message: "Footprint is saved" });
});

// Utility functions & middlewares
// ===============================

exports.findGeolocalisation = route(async (req, res, next) => {
  const { include } = getOwnerScope(req);

  const geolocalisation = await models.geolocalisations.findOne({
    include,
    where: {
      id: req.params.id
    }
  });

  if (!geolocalisation) {
    throw notFoundError(req);
  }

  req.geolocalisation = geolocalisation;
  next();
});
