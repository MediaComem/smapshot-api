const math = require("mathjs");
const fs = require("fs-extra");
const collada2gltf = require("collada2gltf");
const path = require("path");
const { spawn } = require("child_process");
const config = require('../../../config');
const models = require("../../models");
const utils = require("../../utils/express");
const mediaUtils = require('../../utils/media');

exports.generateFromDbPose = utils.route(async (req, res) => {
  const image_id = req.query.image_id;
  // await exports.generateFromDbPosePromise(image_id);
  function computeImageCoordinates (azimuth, tilt, roll, width, height, focal) {
    return new Promise((resolve, reject) => {
      const path2py = path.join(config.root, 'app/georeferencer/computeGltfCoordinates.py')
      const pythonProcess = spawn('python3',[path2py, azimuth, tilt, roll, width, height, focal]);
      pythonProcess.stdout.on('data', (data) => {
        const results = JSON.parse(data.toString())
        resolve(results)
      })
      pythonProcess.stderr.on('data', (data) => {
        reject(data.toString())
      })
    });
  }
  const image = await getSquareImageFromDB(image_id);

  //Do not allow regenerating the gltfs for composite_images for now
  if (image.framing_mode === 'composite_image') {
    // if composite image was georeferenced as single image, ok to regenerate image
    const res_geolocs = await models.geolocalisations.findAll({
      attributes: ["id"],
      where: {
        image_id: image_id,
        state: 'validated'
      }
    });
    if (res_geolocs.length > 1) {
      // do not regenerate the gltfs
      throw new Error("Image id: " + image_id + " is a composite image, gltf can't be regenerated.");
    }
  }

  if (image.state !== "initial" && image.state !== 'waiting_alignment') {
    let results;
    let regionByPx;
    if (image.iiif_data && image.iiif_data.regionByPx) {
      regionByPx = image.iiif_data.regionByPx;
      results = await computeImageCoordinates(image.azimuth, image.tilt, image.roll, regionByPx[2], regionByPx[3], image.focal);
    } else {
      results = await computeImageCoordinates(image.azimuth, image.tilt, image.roll, image.width, image.height, image.focal);
    }
    if (!results) {
     res.status(400).send({ message: req.__('pose.3dModelCreationError') });
    } else {
      const { imageCoordinates } = results;
      try {
        await createGltfFromImageCoordinates(imageCoordinates, image_id, image.collection_id, regionByPx)
        // update geolocalisation with regionByPx if needed
        if (regionByPx) {
          await models.geolocalisations.update(
            {
              region_px: regionByPx
            },
            {
              where: { id: image.geolocalisation_id }
            }
          );
        }
        res.status(201).send({
          message: "Gltf has been successfully created."
        });
      } catch {
        res.status(400).send({ message: req.__('pose.3dModelCreationError') });
      }
    }
  } else {
    throw new Error("Image id: " + image_id + " is not georeferenced.");
  }
});

async function getSquareImageFromDB(image_id, regionByPx) {
  const query = models.images.findOne({
    raw: true,
    attributes: [
      "id",
      [models.sequelize.literal("azimuth%360"), "azimuth"],
      "tilt",
      "roll",
      [models.sequelize.literal("ST_X(location)"), "longitude"],
      [models.sequelize.literal("ST_Y(location)"), "latitude"],
      [models.sequelize.literal("ST_Z(location)"), "altitude"],
      "focal",
      "width",
      "height",
      "state",
      "collection_id",
      "iiif_data",
      "framing_mode",
      "geolocalisation_id"
    ],
    where: {
      id: parseInt(image_id, 10)
    }
  });

  const image = await query;


  //Build media
  image.media = {}
  //Update iiif_data.regionByPx if region is given to put correct region in picpath.
  if (regionByPx) {
    image.iiif_data.regionByPx = regionByPx;
  }
  //set image_url on media and generate tiles
  await mediaUtils.setImageUrl(image, /* image_width */ 1024, /* image_height */ 1024);
  image.media.tiles = mediaUtils.generateImageTiles(image_id, image.collection_id, image.iiif_data);

  return image;
}

async function createGltfFromImageCoordinates(imageCoordinates, image_id, collection_id, regionByPx) {
  //regionByPx = iiif_data.regionByPx, 
  //excepted for composite_images when computing pose during geolocalisation process (= pose-estimation.controller.js "/pose/compute").

  const imageSquaredFromDB = await getSquareImageFromDB(image_id, regionByPx);
  const picPath = imageSquaredFromDB.media.image_url;
  const region_url = regionByPx ? `_${regionByPx[0]}_${regionByPx[1]}_${regionByPx[2]}_${regionByPx[3]}` : "";

  const urCorner = [imageCoordinates.ur[0], imageCoordinates.ur[1], imageCoordinates.ur[2]];
  const ulCorner = [imageCoordinates.ul[0], imageCoordinates.ul[1], imageCoordinates.ul[2]];//imageCoordinates.ul;
  const lrCorner = [imageCoordinates.lr[0], imageCoordinates.lr[1], imageCoordinates.lr[2]];//imageCoordinates.lr;
  const llCorner = [imageCoordinates.ll[0], imageCoordinates.ll[1], imageCoordinates.ll[2]];//imageCoordinates.ll;
  const xyzCam = math.matrix([urCorner, ulCorner, lrCorner, llCorner]);

  // Scale the model
  // ---------------
  const dif = math.subtract(urCorner, ulCorner);
  const dist = math.norm(dif);

  const maxSize = 100; // max size of the bigest side of the image
  let ratio = maxSize / dist;
  let scaledXYZ = math.multiply(xyzCam, ratio);
  // Insert the computed coordinates in the collada template file
  // ------------------------------------------------------------
  // create the coordinate string for collada
  scaledXYZ = math.transpose(scaledXYZ)
  let coordString = "";
  const dim0 = math.subset(math.size(scaledXYZ), math.index([0]));
  const dim1 = math.subset(math.size(scaledXYZ), math.index([1]));
  for (let i = 0; i < dim1; i += 1) {
    for (let j = 0; j < dim0; j += 1) {
      const str = math.subset(scaledXYZ, math.index(j, i)).toFixed(1); // XYZCamOff
      coordString = coordString.concat(str);
      coordString = coordString.concat(" ");
    }
  }

  const path2template = path.join(config.root, 'app/template_collada/collada_template_mix.dae');
  const path2collections = "/data/collections/";

  const path2collada2gltf = path.join(config.root, 'collada2gltf');

  const xml = await fs.readFile(path2template, "utf8");
  // const xml = data;
  let newXml = xml.replace("#IMAGECOORDINATES#", coordString);
  newXml = newXml.replace("#PATH2IMAGE#", picPath); // dds png
  // Save in the temp folder
  const path2tempDae = `${path2collections}${collection_id}/temp_collada/${image_id}${region_url}.dae`;
  await fs.outputFile(path2tempDae, newXml); // outputFile is used instead of writeFile - it create the parent directory if it doesn't exist

  await collada2gltfPromise(path2tempDae, { path: path2collada2gltf });
  // Change uri of the texture
  const path2gltf = `${path2collections}${
    collection_id}/temp_collada/output/${image_id}${region_url}.gltf`;

  // Edit Gltf to replace the texture
  const file = await fs.readFile(path2gltf, "utf8");
  const fileJson = JSON.parse(file);
  fileJson.images[0].uri = picPath;
  await fs.outputFile(path2gltf, JSON.stringify(fileJson), "utf8");

  // Delete automatically created texture
  const path2jpg = `${path2collections}${
    collection_id}/temp_collada/output/${image_id}${region_url}.jpg`;
  await fs.remove(path2jpg);
  await copyGltf(image_id, collection_id, region_url);
}

async function collada2gltfPromise(path2tempDae, options) {
  return new Promise((resolve, reject) => {
    collada2gltf(path2tempDae, options, err => {
      if (err) {
        utils.getLogger().error(err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function copyGltf(image_id, collection_id, region_url) {
  // Generate the path of the files to be copied
  const rootTemp = `/data/collections/${
    collection_id}/temp_collada/output/`;
  const rootGltf = `/data/collections/${
    collection_id}/gltf/`;
  // gltf
  const gltfTemp = `${rootTemp + image_id}${region_url}.gltf`;
  const gltfPath = `${rootGltf + image_id}${region_url}.gltf`;
  await fs.copy(gltfTemp, gltfPath);
}

// exports.createGltf = createGltf;
exports.createGltfFromImageCoordinates = createGltfFromImageCoordinates
