
const Sequelize = require("sequelize");

const models = require("../../models");
const utils = require("../../utils/express");
const config = require('../../../config');
const { cleanProp, getFieldI18n } = require("../../utils/params");

const Op = Sequelize.Op;


exports.getInfo = utils.route(async (req, res) => {
  const queryPromise = await models.users.findOne({
    attributes: [
      "id",
      "username",
      "email",
      "first_name",
      "last_name",
      "letter",
      "has_one_validated",
      "roles",
      "lang",
      "owner_id",
      [
        models.sequelize.literal(
          "CASE WHEN (googleid is null AND facebookid is null) THEN TRUE ELSE FALSE END"
        ),
        "local_login"
      ]
    ],
    where: {
      id: req.user.id
    }
  });

  res.status(200).send(
    await utils.handlePromise(queryPromise, {
      message: "User cannot be retrieved."
    })
  );
});

exports.updateInfo = utils.route(async (req, res) => {
  const validateUpdates = {
    username: req.body.username,
    email: req.body.email,
    first_name: req.body.first_name,
    last_name: req.body.last_name,
    lang: req.body.lang,
    letter: req.body.letter
  };

  const cleanedUpdates = cleanProp(validateUpdates);

  const queryPromise = await models.users.update(cleanedUpdates, {
    where: {
      id: req.user.id
    }
  });

  await utils.handlePromise(queryPromise, {
    status: 500,
    message: "Info cannot be updated."
  });

  res.status(200).send();
});

exports.updatePwd = utils.route(async (req, res) => {
  // CHECK if old password provided is correct
  const queryPromiseUser = await models.users.findOne({
    where: { email: req.user.email }
  });

  const user = await utils.handlePromise(queryPromiseUser, {
    message: "Error retrieving user for check old password"
  });

  if (!(await user.validPassword(req.body.old_pwd)))
    throw utils.createApiError(
      "Password can not be updated. Old password provided is not correct.",
      {
        status: 403
      }
    );

  const queryPromise = await user.update({
    password: req.body.new_pwd
  });

  await utils.handlePromise(queryPromise, {
    status: 500,
    message: "Password cannot be updated."
  });
  res.status(200).send();

});

exports.getGeolocalisations = async (req, res) => {
  const lang = req.getLocale();
  const whereGeo = {
    user_id: req.user.id,
    stop: {
      [Op.not]: null
    },
    date_georef: {
      [Op.gte]: req.query.date_min,
      [Op.lte]: req.query.date_max
    }
  };
  const cleanedWhereGeo = cleanProp(whereGeo);

  const countTotal = await models.geolocalisations.count({
    where: cleanedWhereGeo
  });

  const media = [
    models.sequelize.literal(
      `(case
      when iiif_data IS NOT NULL
      THEN json_build_object('image_url', CONCAT((iiif_data->>'image_service3_url'), '/full/500,/0/default.jpg'))
      else json_build_object('image_url', CONCAT('${config.apiUrl}/data/collections/', collection_id,'/images/500/',geolocalisations.image_id,'.jpg'))
      end)`
    ),
    "media"
  ];
  const queryPromise = models.geolocalisations.findAll({
    attributes: ['id', 'state', 'date_georef', 'remark', 'errors_list'],
    where: cleanedWhereGeo,
    limit: req.query.limit || 100,
    offset: req.query.offset || 0,
    order: [['date_georef', req.query.order || 'DESC']],
    include: [
      {
        model: models.images,
        attributes: ["id", "name", "title", media],
        include: [
          {
            model: models.owners,
            attributes: ["id", [getFieldI18n('image->owner', 'name', lang), "name"]],
          },
          {
            model: models.collections,
            attributes: ["id", [getFieldI18n('image->collection', 'name', lang), "name"]]
          }
        ]
      }
    ]
  });
  // Submit request
  res.header('Total-Items', countTotal).status(200).send(
    await utils.handlePromise(queryPromise, {
      status: 500,
      message: "Geolocalisations cannot be retrieved. There has been an error with the server."
    })
  );
};

exports.getObservations = async (req, res) => {
  const lang = req.getLocale();

  const whereObs = {
    user_id: req.user.id,
    date_created: {
      [Op.gte]: req.query.date_min,
      [Op.lte]: req.query.date_max
    }
  };
  const cleanedWhereObs = cleanProp(whereObs);

  const countTotal = await models.observations.count({
    where: cleanedWhereObs
  });

  const media = [
    models.sequelize.literal(
      `(case
      when iiif_data IS NOT NULL
      THEN json_build_object('image_url', CONCAT((iiif_data->>'image_service3_url'), '/full/500,/0/default.jpg'))
      else json_build_object('image_url', CONCAT('${config.apiUrl}/data/collections/', collection_id,'/images/500/',observations.image_id,'.jpg'))
      end)`
    ),
    "media"
  ];
  const queryPromise = models.observations.findAll({
    attributes: ['id', 'state', 'date_created', 'remark', 'observation'],
    where: cleanedWhereObs,
    limit: req.query.limit || 100,
    offset: req.query.offset || 0,
    order: [['date_created', req.query.order || 'DESC']],
    include: [
      {
        model: models.images,
        attributes: ["id", "name", "title", media],
        include: [
          {
            model: models.owners,
            attributes: ["id", [getFieldI18n('image->owner', 'name', lang), "name"]],
          },
          {
            model: models.collections,
            attributes: ["id", [getFieldI18n('image->collection', 'name', lang), "name"]]
          }
        ]
      }
    ]
  });
  // Submit request
  res.header('Total-Items', countTotal).status(200).send(
    await utils.handlePromise(queryPromise, {
      status: 500,
      message: "Observations cannot be retrieved. There has been an error with the server."
    })
  );
};


exports.getCorrections = async (req, res) => {

  const lang = req.getLocale();

  const whereCorr = {
    user_id: req.user.id,
    date_created: {
      [Op.gte]: req.query.date_min,
      [Op.lte]: req.query.date_max
    },
    '$previous.state$': {
      [Op.or]: {
        [Op.is]: null,
        [Op.ne]: 'updated'
      }
    }
  };
  const cleanedwhereCorr = cleanProp(whereCorr);

  const countTotal = await models.corrections.count({
    where: cleanedwhereCorr,
    include: [
      {
        model: models.corrections,
        as: "previous",
        required: false
      }
    ]
  });

  const media = [
    models.sequelize.literal(
      `(case
      when iiif_data IS NOT NULL
      THEN json_build_object('image_url', CONCAT((iiif_data->>'image_service3_url'), '/full/500,/0/default.jpg'))
      else json_build_object('image_url', CONCAT('${config.apiUrl}/data/collections/', collection_id,'/images/500/',corrections.image_id,'.jpg'))
      end)`
    ),
    "media"
  ];
  const queryPromise = models.corrections.findAll({
    attributes: ['id', 'state', 'date_created', 'remark', 'type', 'correction'],
    where: cleanedwhereCorr,
    limit: req.query.limit || 100,
    offset: req.query.offset || 0,
    order: [['date_created', req.query.order || 'DESC']],
    include: [
      {
        model: models.images,
        attributes: ["id", "name", "title", "caption", "orig_title", "orig_caption", media],
        include: [
          {
            model: models.owners,
            attributes: ["id", [getFieldI18n('image->owner', 'name', lang), "name"]],
          },
          {
            model: models.collections,
            attributes: ["id", [getFieldI18n('image->collection', 'name', lang), "name"]]
          }
        ]
      },
      {
        model: models.corrections,
        as: "update",
        required: false,
        attributes: ["correction"]
      },
      {
        model: models.corrections,
        as: "previous",
        required: false,
        attributes: []
      }
    ]
  });
  // Submit request
  res.header('Total-Items', countTotal).status(200).send(
    await utils.handlePromise(queryPromise, {
      status: 500,
      message: "Corrections cannot be retrieved. There has been an error with the server."
    })
  );
};
