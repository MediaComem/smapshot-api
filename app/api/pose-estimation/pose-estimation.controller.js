const turfHelpers = require("@turf/helpers");
const turf = require("@turf/turf");
const { spawn } = require("child_process");
const path = require('path');
const { root } = require('../../../config');

const models = require("../../models");
const gltf = require("../gltf/gltf.controller");
const { poseEstimationError } = require('../../utils/errors');
const { route } = require("../../utils/express");

async function getDbImage(image_id){
  const query = models.images.findOne({
    raw: true,
    attributes: [
      [models.sequelize.literal("images.azimuth%360"), "azimuth"],
      "images.tilt",
      "images.roll",
      [models.sequelize.literal("ST_X(images.location)"), "longitude"],
      [models.sequelize.literal("ST_Y(images.location)"), "latitude"],
      [models.sequelize.literal("ST_Z(images.location)"), "altitude"],
      "images.focal",
      "width",
      "height",
      "state",
      "view_type",
      "collection_id",
      "geolocalisation_id"
    ],
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
      id: parseInt(image_id, 10)
    }
  });
  return await query
}

function computeCameraPose (lng, lat, alt, azimuth, tilt, roll, gcps, width, height, locked) {
  return new Promise((resolve, reject) => {
    const path2py = path.join(root, 'app/georeferencer/georeferencer.py')
    const pythonProcess = spawn('python3',[path2py, lng, lat, alt, azimuth, tilt, roll, gcps, width, height, locked]);
    pythonProcess.stdout.on('data', (data) => {
      const results = JSON.parse(data.toString())
      resolve(results)
    })
    pythonProcess.stderr.on('data', (data) => {
      reject(data.toString())
    })
  });
}

function computeGCPRatio(_gcpArray, _width, _height) {
   const listPoints = _gcpArray.map(gcp => turfHelpers.point([gcp.x, gcp.y]));

   const bbox = turf.bbox(turfHelpers.featureCollection(listPoints));
   const areaBbox = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]);
   // Compute the image surface
   const areaImage = _width * _height;
   // Compute the ratio of the surface
   const surfaceRatio = Math.round((areaBbox / areaImage) * 100);
   return surfaceRatio;
 }

// Get parameters sent by the client
exports.computePoseCreateGltf = route(async (req, res) => {
   const locationLocked = req.body.locationLocked;
   const GCPs = req.body.gcps;
   const height = parseFloat(req.body.height);
   const width = parseFloat(req.body.width);
   const longitude = parseFloat(req.body.longitude);
   const latitude = parseFloat(req.body.latitude);
   const altitude = parseFloat(req.body.altitude);
   const azimuth = parseFloat(req.body.azimuth);
   const tilt = parseFloat(req.body.tilt);
   const roll = parseFloat(req.body.roll);
   const id = parseInt(req.body.image_id);

   // Get image collection id
   const sql = `
       SELECT collection_id
       FROM images
       WHERE id = ${id}
   `;
   const queryCollectionIdPromise = await models.sequelize.query(sql, {
     type: models.sequelize.QueryTypes.SELECT
   });
   const collection_id = queryCollectionIdPromise[0].collection_id;

   // Compute Pose
   // ------------
    const gcpArrayString = JSON.stringify(GCPs)
    let lock = 0
    if (locationLocked){
      lock=1
    }else{
      lock=0
    }

    let results;
    try {
      results = await computeCameraPose(longitude, latitude, altitude, azimuth, tilt, roll, gcpArrayString, width, height, lock)
    } catch(error) {
      throw poseEstimationError(req);
    }

    if (!results) {
      throw poseEstimationError(req);
    } else {

     const {imageCoordinatesForGltf, ...filteredResults } = results;

     // Compute surface covered with gcps
     const ratio = computeGCPRatio(GCPs, width, height);
     filteredResults.gcpPercentSurface = ratio

     try {
       await gltf.createGltfFromImageCoordinates(imageCoordinatesForGltf, id, collection_id)
       res.status(201).send(filteredResults);
     } catch {
      throw poseEstimationError(req, req.__('pose.3dModelCreationError'));
    }
  }
});

// Get parameters sent by the client
exports.computePoseCreateGltfFromDb = route(async (req, res) => {

  const image_id = parseInt(req.query.image_id);
  const image = await getDbImage(image_id);

  if (image.state !== "initial" && image.state !== 'waiting_alignment' && image.view_type !== 'terrestrial') {
    // Compute Pose
    // ------------
    const GCPs = image['geolocalisation.gcp_json']
    const gcpArrayString = JSON.stringify(GCPs)

    let results;
    try {
      results = await computeCameraPose(image.longitude, image.latitude, image.altitude, image.azimuth, image.tilt, image.roll, gcpArrayString, image.width, image.height, 0)
    } catch(error) {
      throw poseEstimationError(req);
    }

    if (!results) {
      throw poseEstimationError(req);
    } else {

     const {imageCoordinatesForGltf, longitude, latitude, altitude, roll, tilt, azimuth, focal} = results;

     // Compute surface covered with gcps
     const ratio = computeGCPRatio(GCPs, image.width, image.height);

     // Update values stored in image
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
         focal: focal
       },
       {
         where: { id: image_id }
       }
     );

     // Update values stored in geolocalisation
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
         surface_ratio: ratio
       },
       {
         where: { id: image.geolocalisation_id }
       }
     );
     try {
       await gltf.createGltfFromImageCoordinates(imageCoordinatesForGltf, image_id, image.collection_id)
     } catch {
       throw poseEstimationError(req, req.__('pose.3dModelCreationError'));
     }
     return res.json({ success: true, message: "Gltf and orientation are updated" });
    }
  } else {
   return res.json({ success: true, message: "Image id: " + image_id + " is not georeferenced or is terrestrial." });
  }
});
