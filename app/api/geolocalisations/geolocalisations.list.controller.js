const Sequelize = require("sequelize");

const models = require("../../models");
const { route } = require("../../utils/express");
const { inUniqueOrList, cleanProp, iLikeFormatter, getFieldI18n } = require("../../utils/params");
const { notFoundError } = require('../../utils/errors');
const { getOwnerScope: getImageOwnerScope } = require('../images/images.utils');

const Op = Sequelize.Op;

exports.getList = route(async (req, res) => {
  const lang = req.getLocale();

  const whereGeo = {
    image_id: inUniqueOrList(req.query.image_id),
    state: inUniqueOrList(req.query.state),
    stop: {
      [Op.ne]: null
    },
    date_georef: {
      [Op.gte]: req.query.date_georef_min,
      [Op.lte]: req.query.date_georef_max
    }
  };
  const cleanedWhereGeo = cleanProp(whereGeo);

  const { where: whereImagesScope } = getImageOwnerScope(req);
  const whereImages = {
    ...whereImagesScope,
    original_id: inUniqueOrList(req.query.original_id),
    collection_id: inUniqueOrList(req.query.collection_id),
    is_published: req.query.is_published || true
  };
  const cleanedWhereImages = cleanProp(whereImages);

  const whereOwners = { id: inUniqueOrList(req.query.owner_id) };
  const cleanedWhereOwners = cleanProp(whereOwners);

  const whereVolunteer = { username: iLikeFormatter(req.query.username_volunteer) };
  const cleanedWhereVolunteer = cleanProp(whereVolunteer);

  const countTotal = await models.geolocalisations.count({
    where: cleanedWhereGeo,
    include: [
      {
        model: models.images,
        where: cleanedWhereImages
      },
      {
        model: models.users,
        as: "volunteer",
        where: cleanedWhereVolunteer
      }
    ]
  });

  const geolocalisations = await models.geolocalisations.findAll({
    where: cleanedWhereGeo,
    limit: req.query.limit || 100,
    offset: req.query.offset || 0,
    order: [['date_georef', req.query.order || 'DESC']],
    include: [
      {
        model: models.images,
        attributes: ["id", "original_id", "title", "is_published"],
        where: cleanedWhereImages,
        include: [
          {
            model: models.owners,
            attributes: [[getFieldI18n('image->owner', 'name', lang), "name"]],
            where: cleanedWhereOwners
          },
          {
            model: models.collections,
            attributes: ["id", [getFieldI18n('image->collection', 'name', lang), "name"]]
          }
        ]
      },
      {
        model: models.users,
        as: "volunteer",
        attributes: ["username"],
        where: cleanedWhereVolunteer
      },
      {
        model: models.users,
        as: "validator",
        attributes: ["username"],
        required: false
      }
    ]
  });
  
  if (geolocalisations === null) {
    throw notFoundError(req);
  }
  // Submit request
  res.header('Total-Items', countTotal).send(geolocalisations);
});

exports.getRanking = route(async (req, res) => {
  const whereGeoloc = {
    user_id: inUniqueOrList(req.query.user_id),
    validator_id: inUniqueOrList(req.query.validator_id),
    state: inUniqueOrList(req.query.state),
    stop: {
      [Op.ne]: null
    },
    date_georef: {
      [Op.gte]: req.query.date_georef_min,
      [Op.lte]: req.query.date_georef_max
    }
  };
  const cleanedWhereGeoloc = cleanProp(whereGeoloc);

  const whereImages = {
    owner_id: inUniqueOrList(req.query.owner_id),
    collection_id: inUniqueOrList(req.query.collection_id),
    photographer_id: inUniqueOrList(req.query.photographer_id)
  };

  const cleanedWhereImages = cleanProp(whereImages);

  const whereVolunteer = { username: iLikeFormatter(req.query.username_volunteer) };
  const cleanedWhereVolunteer = cleanProp(whereVolunteer);

  const geolocalisations = await models.geolocalisations.findAll({
    attributes: [
      [ models.sequelize.fn("COUNT", models.sequelize.col("*")), "nObs"]
    ],
    include: [
      {
        model: models.images,
        attributes: [],
        where: cleanedWhereImages
      },
      {
        model: models.users,
        as: "volunteer",
        attributes: ["id", "username"],
        where: cleanedWhereVolunteer
      }
    ],
    where: cleanedWhereGeoloc,
    group: ["geolocalisations.user_id", "volunteer.id"],
    order: models.sequelize.literal('"nObs" DESC')
  });

  if (geolocalisations === null) {
    throw notFoundError(req);
  }

  res.status(200).send(geolocalisations);
});
