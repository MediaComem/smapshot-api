const math = require("mathjs");
const fs = require("fs-extra");
const collada2gltf = require("collada2gltf");
const path = require("path");
const { spawn } = require("child_process");
const config = require('../../../config');
const models = require("../../models");
const utils = require("../../utils/express");
const iiifLevel0Utils = require('../../utils/IIIFLevel0');

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
  const image = await getDbImage(image_id);
  if (image.state !== "initial" && image.state !== 'waiting_alignment') {
    let results = await computeImageCoordinates(image.azimuth, image.tilt, image.roll, image.width, image.height, image.focal)
    if (!results) {
     res.status(400).send({ message: req.__('pose.3dModelCreationError') });
    } else {
      const { imageCoordinates } = results;
      try {
        await createGltfFromImageCoordinates(imageCoordinates, image_id, image.collection_id)
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

async function getDbImage(image_id) {
  const query = models.images.findOne({
    raw: true,
    attributes: [
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
      [
        models.sequelize.literal(
        `(CASE
          WHEN iiif_data IS NOT NULL
              THEN case
                WHEN  iiif_data->>'size_info' IS NOT NULL
                THEN json_build_object('image_url', NULL)
                ELSE json_build_object('image_url', CONCAT((images.iiif_data->>'image_service3_url'), '/full/1024,1024/0/default.jpg'))
                END
          ELSE
              json_build_object('image_url',CONCAT('${config.apiUrl}/data/collections/', collection_id,'/images/1024/',images.id,'.jpg'))
          end)`
        ),
        "media"
      ]
    ],
    where: {
      id: parseInt(image_id, 10)
    }
  });

  const result = await query

  const iiifLevel0Promise = [];

  const media = result.media;
  if (media && media.image_url === null &&
    iiifLevel0Utils.isIIIFLevel0(result.iiif_data)) {
    iiifLevel0Promise.push(iiifLevel0Utils.getImageMediaUrl(media, result.iiif_data.size_info, 1024));
  }

  await Promise.all(iiifLevel0Promise);

  delete result.iiif_data;

  return result
}

async function createGltfFromImageCoordinates(imageCoordinates, image_id, collection_id) {

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
  const imageSquaredFromDB = await getDbImage(image_id);
  const picPath = imageSquaredFromDB.media.image_url;
  newXml = newXml.replace("#PATH2IMAGE#", picPath); // dds png
  // Save in the temp folder
  const path2tempDae = `${path2collections}${collection_id}/temp_collada/${image_id}.dae`;
  await fs.outputFile(path2tempDae, newXml); // outputFile is used instead of writeFile - it create the parent directory if it doesn't exist

  await collada2gltfPromise(path2tempDae, { path: path2collada2gltf });
  // Change uri of the texture
  const path2gltf = `${path2collections}${
    collection_id}/temp_collada/output/${image_id}.gltf`;

  // Edit Gltf to replace the texture
  const file = await fs.readFile(path2gltf, "utf8");
  const fileJson = JSON.parse(file);
  fileJson.images[0].uri = picPath;
  await fs.outputFile(path2gltf, JSON.stringify(fileJson), "utf8");

  // Delete automatically created texture
  const path2jpg = `${path2collections}${
    collection_id}/temp_collada/output/${image_id}.jpg`;
  await fs.remove(path2jpg);
  await copyGltf(image_id, collection_id);
}

async function collada2gltfPromise(path2tempDae, options) {
  return new Promise((resolve, reject) => {
    collada2gltf(path2tempDae, options, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function copyGltf(image_id, collection_id) {
  // Generate the path of the files to be copied
  const rootTemp = `/data/collections/${
    collection_id}/temp_collada/output/`;
  const rootGltf = `/data/collections/${
    collection_id}/gltf/`;
  // gltf
  const gltfTemp = `${rootTemp + image_id}.gltf`;
  const gltfPath = `${rootGltf + image_id}.gltf`;
  await fs.copy(gltfTemp, gltfPath);
}

// exports.createGltf = createGltf;
exports.createGltfFromImageCoordinates = createGltfFromImageCoordinates
