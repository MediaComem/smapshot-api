const Sequelize = require("sequelize");

const models = require("../../models");
const utils = require("../../utils/express");
const config = require('../../../config');
const { inUniqueOrList, cleanProp, iLikeFormatter, getFieldI18n } = require("../../utils/params");
const { getOwnerScope: getImageOwnerScope } = require('../images/images.utils');
const loadIIIFLevel0Utils = require('../../utils/loadIIIFLevel0Image');

const Op = Sequelize.Op;

// GET /corrections
// ================

exports.getList = utils.route(async (req, res) => {
  const lang = req.getLocale();

  const whereCorrections = {
    id: inUniqueOrList(req.query.id),
    state: inUniqueOrList(req.query.state),
    date_created: {
      [Op.gte]: req.query.date_created_min,
      [Op.lte]: req.query.date_created_max
    }
  };
  const cleanedWhereCorrections = cleanProp(whereCorrections);

  const { where: whereImagesScope } = getImageOwnerScope(req);
  const whereImages = {
    ...whereImagesScope,
    original_id: inUniqueOrList(req.query.original_id)
  };
  const cleanedWhereImages = cleanProp(whereImages);

  const whereOwners = { id: inUniqueOrList(req.query.owner_id) };
  const cleanedWhereOwners = cleanProp(whereOwners);

  const whereCollections = { id: inUniqueOrList(req.query.collection_id) };
  const cleanedWhereCollections = cleanProp(whereCollections);

  const whereVolunteers = {
    id: inUniqueOrList(req.query.volunteer_id),
    username: inUniqueOrList(iLikeFormatter(req.query.username_volunteer))
  };
  const cleanedWhereVolunteers = cleanProp(whereVolunteers);

  const media = [
    models.sequelize.literal(
      `(case
      when iiif_data IS NOT NULL
      THEN case 
        WHEN iiif_data->>'size_info' IS NOT NULL
          THEN json_build_object('image_url', NULL)
          else json_build_object('image_url', CONCAT((iiif_data->>'image_service3_url'), '/full/500,/0/default.jpg'))
        end
      else json_build_object('image_url', CONCAT('${config.apiUrl}/data/collections/', collection_id,'/images/500/',corrections.image_id,'.jpg'))
      end)`
    ),
    "media"
  ];
  // TODO change query to add update and do not send admin updates separately in the list
  const corrections = await models.corrections.findAll({
    attributes: [
      "id",
      "previous_correction_id",
      "type",
      "correction",
      "date_created",
      "date_validated",
      "downloaded",
      "is_original",
      "remark",
      "state"
    ],
    limit: req.query.limit || 30,
    offset: req.query.offset || 0,
    where: cleanedWhereCorrections,
    order: [["id"]],
    include: [
      {
        model: models.corrections,
        attributes: ["correction"],
        as: "update",
        required: false
      },
      {
        model: models.images,
        attributes: ["id", "original_id", "title", "caption", "is_published", "orig_title", "orig_caption", "iiif_data", media],
        where: cleanedWhereImages,
        include: [
          {
            model: models.owners,
            attributes: [[getFieldI18n('image->owner','name',lang), "name"]],
            where: cleanedWhereOwners
          },
          {
            model: models.collections,
            attributes: ["id", [getFieldI18n('image->collection','name',lang), "name"]],
            where: cleanedWhereCollections
          }
        ]
      },
      {
        model: models.users,
        as: "volunteer",
        attributes: ["username"],
        where: cleanedWhereVolunteers
      },
      {
        model: models.users,
        as: "validator",
        attributes: ["username"],
        required: false
      }
    ]
  });

  const searchImagePromise = [];
  corrections.forEach(correction => {
    if (correction.dataValues.image.dataValues.media && correction.dataValues.image.dataValues.media.image_url === null && correction.dataValues.image.dataValues.iiif_data) {
      searchImagePromise.push(loadIIIFLevel0Utils.getUrlOnImage(correction.dataValues.image.dataValues.media, correction.dataValues.image.dataValues.iiif_data.size_info, 500));
    }
  })

  await Promise.all(searchImagePromise);

  corrections.forEach(correction => {
    delete correction.dataValues.image.dataValues.iiif_data;
  });

  res.status(200).send(corrections);
});

// GET /corrections/ranking
// ========================

exports.getRanking = utils.route(async (req, res) => {
  const whereObs = {
    user_id: { [Op.and]: [ inUniqueOrList(req.query.user_id),
                         { [Op.ne]: {[Op.col]: 'corrections.validator_id' } } ]}, // validator update do not count
    validator_id: inUniqueOrList(req.query.validator_id),
    state: inUniqueOrList(req.query.state),
    date_created: {
      [Op.gte]: req.query.date_created_min,
      [Op.lte]: req.query.date_created_max
    }
  };
  const cleanedWhereObs = cleanProp(whereObs);

  const whereImages = {
    owner_id: inUniqueOrList(req.query.owner_id),
    collection_id: inUniqueOrList(req.query.collection_id),
    photographer_id: inUniqueOrList(req.query.photographer_id)
  };

  const cleanedWhereImages = cleanProp(whereImages);

  const whereVolunteer = { username: iLikeFormatter(req.query.username_volunteer) };
  const cleanedWhereVolunteer = cleanProp(whereVolunteer);

  const queryPromise = await models.corrections.findAll({
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
    where: cleanedWhereObs,
    group: ["corrections.user_id", "volunteer.id"],
    order: models.sequelize.literal('"nObs" DESC')
  });

  res.status(201).send(
    await utils.handlePromise(queryPromise, {
      message: "Rankings cannot be retrieved."
    })
  );
});
