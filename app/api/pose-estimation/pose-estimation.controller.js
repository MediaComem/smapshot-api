const turfHelpers = require("@turf/helpers");
const turf = require("@turf/turf");
const { spawn } = require("child_process");
const path = require('path');
const config = require('../../../config');

const models = require("../../models");
const gltf = require("../gltf/gltf.controller");
const { poseEstimationError } = require('../../utils/errors');
const { route, getLogger } = require("../../utils/express");
const mediaUtils = require('../../utils/media');

const cv = require("../../../utils/opencv");
const Jimp = require('jimp');

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
      "geolocalisation_id",
      "iiif_data",
      "framing_mode"
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
    const path2py = path.join(config.root, 'app/georeferencer/georeferencer.py')
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

async function computePoseNewCrop(req, id, gcps, imageDimensions) {
  const image_id = parseInt(id);
  const image = await getDbImage(image_id);
  const gcpArrayString = JSON.stringify(gcps);
  let results;
  try {
    results = await computeCameraPose(image.longitude, image.latitude, image.altitude, image.azimuth, image.tilt, image.roll, gcpArrayString, imageDimensions[2], imageDimensions[3], 0);
  } catch(error) {
    getLogger().error(error);
    throw poseEstimationError(req);
  }

  if (!results) {
    throw poseEstimationError(req);
  } else {
    const {imageCoordinatesForGltf, longitude, latitude, altitude, roll, tilt, azimuth, focal} = results;

    // Compute surface covered with gcps
    const ratio = computeGCPRatio(gcps, imageDimensions[2], imageDimensions[3]);

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

    // Update values stored in geolocalisation (except the gcps)
    const image_region = image.iiif_data ? image.iiif_data.regionByPx : null; //For composite_images, the gltfs are not regenerated, so the regions will always come from iiif_data.

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
        surface_ratio: ratio,
        region_px: image_region
      },
      {
        where: { id: image.geolocalisation_id }
      }
    );

    try {
      await gltf.createGltfFromImageCoordinates(imageCoordinatesForGltf, image_id, image.collection_id, image_region)
    } catch (error) {
      getLogger().error(error);
      throw poseEstimationError(req, req.__('pose.3dModelCreationError'));
    }
  }
  
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
   const imageModifier = req.body.image_modifiers;

   let regionByPx = req.body.regionByPx; //get region from front-end for composite_images

    // Get image collection id and region
    const sql = `
        SELECT collection_id, iiif_data->'regionByPx' AS regionbypx
        FROM images
        WHERE id = ${id}
    `;
    const queryCollectionIdPromise = await models.sequelize.query(sql, {
      type: models.sequelize.QueryTypes.SELECT
    });
    const collection_id = queryCollectionIdPromise[0].collection_id;
    if (!regionByPx) {
      regionByPx = queryCollectionIdPromise[0].regionbypx; //for image without cumulative_views, take the region from the iiif_data
    }

    const path2collections = "/data/collections/";
    const path2image = `${path2collections}${
      collection_id}/images/output/${id}.png`;

    let jimpSrc = await Jimp.read(`${config.apiUrl}${path2collections}${collection_id}/images/1024/${id}.jpg`);
    var src = cv.matFromImageData(jimpSrc.bitmap);
    let dst = new cv.Mat();
    let texture = new cv.Mat();
    let dsize = new cv.Size(src.cols, src.rows);
    let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, dsize.width, 0, 0, dsize.height, dsize.width, dsize.height]);
    let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [imageModifier.modifier, 0, dsize.width-imageModifier.modifier, 0, 0, dsize.height, dsize.width, dsize.height]);
    let M = cv.getPerspectiveTransform(srcTri, dstTri);

    cv.warpPerspective(src, dst, M, dsize);
    cv.flip(dst,texture,0);
    let resized_image = new cv.Mat();
    cv.resize(dst, resized_image,new cv.Size(imageModifier.imageSize.width, imageModifier.imageSize.height), 0, 0, cv.INTER_AREA);
    new Jimp({
      width: resized_image.cols,
      height: resized_image.rows,
      data: Buffer.from(resized_image.data)
      })
      .write(path2image);

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
        getLogger().error(error);
        throw poseEstimationError(req);
      }

      if (!results) {
        throw poseEstimationError(req);
      } else {

      const {imageCoordinatesForGltf, ...filteredResults } = results;

      // Compute surface covered with gcps
      const ratio = computeGCPRatio(GCPs, width, height);
      filteredResults.gcpPercentSurface = ratio;

      //Add region and url_gltf in results
      filteredResults.image_id = id;
      filteredResults.regionByPx = regionByPx;

      //Build gltf_url
      filteredResults.gltf_url = mediaUtils.generateGltfUrl(id, collection_id, regionByPx);
      try {
        await gltf.createGltfFromImageCoordinates(imageCoordinatesForGltf, id, collection_id, regionByPx, path2image)
        res.status(201).send(filteredResults);
      } catch (error) {
        getLogger().error(error);
        throw poseEstimationError(req, req.__('pose.3dModelCreationError'));
      }
    }
   
});

// Get parameters sent by the client
exports.computePoseCreateGltfFromDb = route(async (req, res) => {

  const image_id = parseInt(req.query.image_id);
  const image = await getDbImage(image_id);

  //Do not allow regenerating the gltfs for composite_images for now
  if (image.framing_mode === 'composite_image') {
    return res.json({ success: false, message: "Image id: " + image_id + " is a composite image, gltf can't be regenerated." });
  }
  
  if (image.state !== "initial" && image.state !== 'waiting_alignment' && image.view_type !== 'terrestrial') {
    // Compute Pose
    // ------------
    let GCPs;
    //if image cropped, offset the gcps stored in db with the region
    const GCPs_db = image['geolocalisation.gcp_json'];
    if (image.iiif_data && image.iiif_data.regionByPx) {
      GCPs = GCPs_db.map( gcp => {
        return {
          ...gcp,
          x: gcp.x-image.iiif_data.regionByPx[0],
          xReproj: gcp.xReproj-image.iiif_data.regionByPx[0],
          y: gcp.y-image.iiif_data.regionByPx[1],
          yReproj: gcp.yReproj-image.iiif_data.regionByPx[1]
        };
      });
    } else {
      GCPs = GCPs_db;
    }
    const gcpArrayString = JSON.stringify(GCPs);

    //if image cropped, get new width and height
    const image_width = image.iiif_data && image.iiif_data.regionByPx ? image.iiif_data.regionByPx[2] : image.width;
    const image_height = image.iiif_data && image.iiif_data.regionByPx ? image.iiif_data.regionByPx[3] : image.height;

    let results;
    try {
      results = await computeCameraPose(image.longitude, image.latitude, image.altitude, image.azimuth, image.tilt, image.roll, gcpArrayString, image_width, image_height, 0)
    } catch(error) {
      getLogger().error(error);
      throw poseEstimationError(req);
    }

    if (!results) {
      throw poseEstimationError(req);
    } else {

     const {imageCoordinatesForGltf, longitude, latitude, altitude, roll, tilt, azimuth, focal} = results;

     // Compute surface covered with gcps
     const ratio = computeGCPRatio(GCPs, image_width, image_height);

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
     const image_region = image.iiif_data ? image.iiif_data.regionByPx : null;

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
         surface_ratio: ratio,
         region_px: image_region
       },
       {
         where: { id: image.geolocalisation_id }
       }
     );
     try {
       await gltf.createGltfFromImageCoordinates(imageCoordinatesForGltf, image_id, image.collection_id, image_region)
     } catch (error) {
      getLogger().error(error);
       throw poseEstimationError(req, req.__('pose.3dModelCreationError'));
     }
     return res.json({ success: true, message: "Gltf and orientation are updated" });
    }
  } else {
   return res.json({ success: true, message: "Image id: " + image_id + " is not georeferenced or is terrestrial." });
  }
});

exports.computePoseNewCrop = computePoseNewCrop
