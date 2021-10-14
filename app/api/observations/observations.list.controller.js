const Sequelize = require("sequelize");

const models = require("../../models");
const utils = require("../../utils/express");
const { inUniqueOrList, cleanProp, iLikeFormatter, getFieldI18n } = require("../../utils/params");

const Op = Sequelize.Op;

exports.getList = utils.route(async (req, res) => {
  const lang = req.getLocale();
  const isSuperUser = req.user ? req.user.isSuperAdmin() : false;
  const userOwnerId = req.user ? req.user.owner_id : undefined;

  let whereObs = {
    id: inUniqueOrList(req.query.id),
    image_id: inUniqueOrList(req.query.image_id),
    state: req.user ? inUniqueOrList(req.query.state) : 'validated', // if not authenticated allow only validated
    date_created: {
      [Op.gte]: req.query.date_created_min,
      [Op.lte]: req.query.date_created_max
    }
  };

  const cleanedWhereObs = cleanProp(whereObs);

  const whereImages = {
    original_id: inUniqueOrList(req.query.original_id),
    owner_id: isSuperUser ? undefined : userOwnerId
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
  const queryPromise = models.observations.findAll({
    attributes:  req.user ? [ // if not authenticated, remark is not shown
      "id",
      "date_created",
      "observation",
      "state",
      "remark",
      "download_timestamp",
      "coord_x",
      "coord_y",
      "width",
      "height"
    ] : [
      "id",
      "date_created",
      "observation",
      "state",
      "download_timestamp",
      "coord_x",
      "coord_y",
      "width",
      "height"
    ],
    limit: req.query.limit || 30,
    offset: req.query.offset || 0,
    where: cleanedWhereObs,
    order: [["id"]],
    include: [
      // If the user provide the image_id attribute, no need to return same data for each observation
      ...(!req.query.image_id ?
      [{
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
            attributes: ["id", [getFieldI18n('image->collection', 'name', lang), "name"]],
            where: cleanedWhereCollections
          }
        ]
      }]: [
        {
          model: models.images,
          attributes: ["id", "original_id", "title", "is_published"],
          where: cleanedWhereImages
        }
      ]),
      {
        model: models.users,
        as: "volunteer",
        attributes: ["id", "username"],
        where: cleanedWhereVolunteers
      },
      req.user ?  // if not authenticated, validator is not shown
      {
          model: models.users,
          as: "validator",
          attributes: ["id", "username"],
          required: false
      } : {
          model: models.users,
          as: "validator",
          attributes: [],
          required: false
      }
    ]
  });

  let observations = await utils.handlePromise(queryPromise, {
    message: "Observations cannot be retrieved."
  });
  res.status(200).send(observations);
});

exports.getRanking = utils.route(async (req, res) => {
  const whereObs = {
    user_id: inUniqueOrList(req.query.user_id),
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

  const queryPromise = await models.observations.findAll({
    attributes: [
      [ models.sequelize.fn("COUNT", "user_id"), "nObs"]
    ],
    include: [
      {
        model: models.images,
        attributes: [],
        where: cleanedWhereImages
      },
      {
        as: 'volunteer',
        model: models.users,
        attributes: ["id", "username"]
      }
    ],
    where: cleanedWhereObs,
    group: ["observations.user_id", "volunteer.id"],
    order: models.sequelize.literal('"nObs" DESC')
  });

  res.status(200).send(
    await utils.handlePromise(queryPromise, {
      message: "Rankings cannot be retrieved."
    })
  );
});
