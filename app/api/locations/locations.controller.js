const models = require("../../models");
const utils = require("../../utils/express");
const { notFoundError, authorizationError, requestBodyValidationError } = require("../../utils/errors");
const { inUniqueOrList } = require("../../utils/params");

const aprioriLocationAttributes = [
  "id",
  "image_id",
  [models.sequelize.literal("ST_X(apriori_locations.geom)"), "longitude"],
  [models.sequelize.literal("ST_Y(apriori_locations.geom)"), "latitude"],
  "azimuth",
  "exact"
];

async function assertCollectionOwnerScope(req, collectionId) {
  if (req.user.isSuperAdmin()) {
    return;
  }

  const collection = await models.collections.findByPk(collectionId, {
    attributes: [ 'owner_id' ]
  });

  if (!collection || collection.owner_id !== req.user.owner_id) {
    throw authorizationError(req.__('general.accessForbidden'));
  }
}

async function assertImageOwnerScope(req, imageId) {
  if (req.user.isSuperAdmin()) {
    return;
  }

  const image = await models.images.findByPk(imageId, {
    attributes: [],
    include: [{
      model: models.collections,
      attributes: [ 'owner_id' ]
    }]
  });

  if (!image || !image.collection || image.collection.owner_id !== req.user.owner_id) {
    throw authorizationError(req.__('general.accessForbidden'));
  }
}

function findAprioriLocations(imagesWhere) {
  return models.apriori_locations.findAll({
    attributes: [
      ...aprioriLocationAttributes,
      [ models.sequelize.col('image.title'), 'title' ]
    ],
    include: [{
      model: models.images,
      attributes: [],
      where: imagesWhere
    }],
    order: [ [ 'id', 'ASC' ] ]
  });
}

exports.getCountryCode = utils.route(async (req, res) => {
  const longitude = req.params.longitude;
  const latitude = req.params.latitude;

  const queryPromise = await models.countries.findOne({
    attributes: ['iso_a2'],
    where: {
      wkb_geometry: models.sequelize.literal(`st_intersects("wkb_geometry", ST_SetSRID(ST_Point(${longitude}, ${latitude}), 4326))`)
    }
  });

  const result = await utils.handlePromise(queryPromise, {
    message: "Country cannot be retrieved."
  });

  // No result, No country (for example point in the ocean)
  if(!result){
    throw notFoundError(req, req.__('locations.noCountry'));
  }

  res.status(200).send(result.iso_a2);
});

exports.getAprioriLocationsByCollection = utils.route(async (req, res) => {
  const collectionId = req.params.collectionId;
  const state = req.query.state || 'initial';

  await assertCollectionOwnerScope(req, collectionId);

  const aprioriLocations = await findAprioriLocations({
    collection_id: collectionId,
    state: inUniqueOrList(state)
  });

  res.status(200).send(aprioriLocations);
});

exports.getAprioriLocationsByImage = utils.route(async (req, res) => {
  const imageId = req.params.imageId;

  await assertImageOwnerScope(req, imageId);

  const aprioriLocations = await findAprioriLocations({ id: imageId });

  res.status(200).send(aprioriLocations);
});

exports.updateExactLocation = utils.route(async (req, res) => {
  const imageId = req.params.imageId;
  const { longitude, latitude } = req.body;
  const user = req.user;

  const image = await models.images.findByPk(imageId, {
    attributes: [ 'id', 'original_id', 'state' ],
    include: [{
      model: models.collections,
      attributes: [ 'owner_id' ]
    }]
  });

  if (!image || !image.collection || (!user.isSuperAdmin() && image.collection.owner_id !== user.owner_id)) {
    throw authorizationError(req.__('general.accessForbidden'));
  }

  if (image.state === 'waiting_validation' || image.state === 'validated') {
    throw requestBodyValidationError(req, [{
      location: 'body',
      path: '',
      message: req.__('locations.imageAlreadyGeoreferenced'),
      validation: 'imageAlreadyGeoreferenced'
    }]);
  }

  const geom = models.sequelize.fn(
    "ST_SetSRID",
    models.sequelize.fn("ST_MakePoint", longitude, latitude, 1000),
    "4326"
  );

  // Replace any previous apriori locations of the image with the new, exact
  // one. This is done in a transaction so that either both changes are
  // applied, or none of them are (e.g. if the creation of the new apriori
  // location fails, the previous one(s) must not be destroyed).
  const newAprioriLocation = await models.sequelize.transaction(async transaction => {
    await models.apriori_locations.destroy({
      where: { image_id: image.id },
      transaction
    });

    return models.apriori_locations.create({
      image_id: image.id,
      original_id: image.original_id,
      geom,
      exact: true
    }, { transaction });
  });

  res.status(200).send({
    id: newAprioriLocation.id,
    image_id: image.id,
    longitude,
    latitude,
    azimuth: null,
    exact: true
  });
});

exports.deleteAprioriLocation = utils.route(async (req, res) => {
  const aprioriLocationId = req.params.aprioriLocationId;
  const user = req.user;

  const aprioriLocation = await models.apriori_locations.findByPk(aprioriLocationId, {
    include: [{
      model: models.images,
      attributes: [ 'id' ],
      include: [{
        model: models.collections,
        attributes: [ 'owner_id' ]
      }]
    }]
  });

  if (
    !aprioriLocation || !aprioriLocation.image || !aprioriLocation.image.collection ||
    (!user.isSuperAdmin() && aprioriLocation.image.collection.owner_id !== user.owner_id)
  ) {
    throw authorizationError(req.__('general.accessForbidden'));
  }

  await aprioriLocation.destroy();

  res.status(200).send({
    message: "The apriori location was deleted."
  });
});

