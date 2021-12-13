const Sequelize = require("sequelize");

const models = require("../../models");
const utils = require("../../utils/express");
const config = require('../../../config');
const { inUniqueOrList, cleanProp, iLikeFormatter, getFieldI18n } = require("../../utils/params");
const iiifLevel0Utils = require('../../utils/IIIFLevel0');

const Op = Sequelize.Op;

//get observations according to the different roles of the user: superAdmin, owner or volunteer
const getObservations = async (req, isSuperUser, onlyOwner, onlyUser) => {
  const lang = req.getLocale();
  const userOwnerId = onlyOwner ? req.user.owner_id : undefined;
  const userId = onlyUser? req.user.id : undefined;

  //only owner administrator, validator or user can see non validated observations related to them
  let states = req.query.state;
  //check if user is allowed to retrieve the state provided
  if (!isSuperUser && !onlyOwner && !onlyUser) {
    if (typeof(states) === 'string') { //if request contains one state
      if (states && states !== "validated") {
        return []; //return empty array if not allowed
      }
    } else if (states instanceof Array) { //if request contains more than one state
      const allowedStates = states.filter(state => state === 'validated');
      states = allowedStates;
    } else { //if no state is provided, provide only validated
      states = "validated";
    }
  }

  let whereObs = {
    id: inUniqueOrList(req.query.id),
    image_id: inUniqueOrList(req.query.image_id),
    state: inUniqueOrList(states),
    date_created: {
      [Op.gte]: req.query.date_created_min,
      [Op.lte]: req.query.date_created_max
    },
    date_validated:{
      [Op.gte]: req.query.date_validated_min,
      [Op.lte]: req.query.date_validated_max
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

  let volunteer_ids = req.query.volunteer_id;
  if (onlyUser) { //get observations related to the volunteer role of the user if the option is set to true
    if (typeof(volunteer_ids) ==='number') {
      if (volunteer_ids && volunteer_ids !== userId) {
        return [] //do not return anything for the onlyUser role
      }
    } else if (volunteer_ids instanceof Array){
      if (volunteer_ids.includes(userId)) {
        volunteer_ids = userId; //return only user observation for the onlyUser role
      } else {
        return [] //do not return anything for onlyUser role
      }
    } else { //no volunteer_ids provided
      volunteer_ids = userId;
    }
  }

  const whereVolunteers = {
    id: inUniqueOrList(volunteer_ids),
    username: inUniqueOrList(iLikeFormatter(req.query.username_volunteer))
  };
  const cleanedWhereVolunteers = cleanProp(whereVolunteers);
  const attributes = [
    "id",
    "date_created",
    "observation",
    "state",
    "date_validated",
    "download_timestamp",
    "coord_x",
    "coord_y",
    "width",
    "height"
  ];
  let validator = {
    model: models.users,
    as: "validator",
    attributes: [],
    required: false
  };
  if (isSuperUser || onlyOwner || onlyUser) {
    // return remark and validator attributes only for super admin, owner of collection or the author of the observation
    attributes.push("remark");
    validator = {
      model: models.users,
      as: "validator",
      attributes: ["id", "username"],
      required: false
    }
  }

  const media = [
    models.sequelize.literal(
      `(case
      when iiif_data IS NOT NULL
      THEN case
        WHEN iiif_data->>'size_info' IS NOT NULL
          THEN json_build_object('image_url', NULL,
                                 'tiles', json_build_object('type', 'iiif', 'url', CONCAT(iiif_data->>'image_service3_url', '/info.json')))
          else json_build_object('image_url', CONCAT((iiif_data->>'image_service3_url'), '/full/500,/0/default.jpg'),
                                 'tiles', json_build_object('type', 'iiif', 'url', CONCAT(iiif_data->>'image_service3_url', '/info.json')))
        end
      else json_build_object('image_url', CONCAT('${config.apiUrl}/data/collections/', collection_id,'/images/500/',observations.image_id,'.jpg'),
                             'tiles', json_build_object('type', 'dzi', 'url', CONCAT('${config.apiUrl}/data/collections/', collection_id,'/images/tiles/', observations.image_id,'.dzi')))
      end)`
    ),
    "media"
  ];

  const observations = await models.observations.findAll({
    attributes,
    where: cleanedWhereObs,
    order: [["id"]],
    include: [
      // If the user provide the image_id attribute, no need to return same data for each observation
      ...(!req.query.image_id ?
      [{
        model: models.images,
        attributes: ["id", "original_id", "title", "is_published", "iiif_data", media],
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
          attributes: ["id", "original_id", "title", "is_published", "iiif_data", media],
          where: cleanedWhereImages
        }
      ]),
      {
        model: models.users,
        as: "volunteer",
        attributes: ["id", "username"],
        where: cleanedWhereVolunteers
      },
      validator
    ]
  });


  const iiifLevel0Promise = [];
  observations.forEach(observation => {
    const image = observation.dataValues.image.dataValues;
    if (image.media && image.media.image_url === null &&
      iiifLevel0Utils.isIIIFLevel0(image.iiif_data)) {
      iiifLevel0Promise.push(iiifLevel0Utils.getImageMediaUrl(image.media, image.iiif_data.size_info, 500));
    }
  })

  await Promise.all(iiifLevel0Promise);

  observations.forEach(observation => {
    delete observation.dataValues.image.dataValues.iiif_data;
  });

  return observations;
}

exports.getList = utils.route(async (req, res) => {
  const isSuperUser = req.user ? req.user.isSuperAdmin() : false;
  const isOwnerAdmin = req.user ? req.user.isOwnerAdmin() : false;
  const isOwnerValidator = req.user ? req.user.isOwnerValidator() : false;

  //get observations according to the different roles of the user: superAdmin, owner or volunteer
  let observationsAll;

  //CASE 1: user has role super admin
  if(isSuperUser){
    //get all observations with all attributes
    observationsAll = await getObservations(req, true/*isSuperAdmin*/, false/*onlyOwner*/, false/*onlyUser*/); 

  //CASE 2: user has role owner administrator or validator
  } else if(isOwnerAdmin||isOwnerValidator){
    //get all observations related to the volunteer role
    const observationsUser = await getObservations(req, false/*isSuperAdmin*/, false/*onlyOwner*/, true/*onlyUser*/); 

    //get all observations related to the owner role
    const observationsPrivate = await getObservations(req, false/*isSuperAdmin*/, true/*onlyOwner*/, false/*onlyUser*/); 

    //get observations with restriction (only validated state, and validator and remark are not shown)
    const observationsPublic = await getObservations(req, false/*isSuperAdmin*/, false/*onlyOwner*/, false/*onlyUser*/); 

    observationsAll = [...observationsUser, ...observationsPrivate, ...observationsPublic];

    //CASE 3: user is not a super admin or an owner administrator/validator
  } else if(req.user){
    //get all observations related to the volunteer role
    const observationsUser = await getObservations(req, false/*isSuperAdmin*/, false/*onlyOwner*/, true/*onlyUser*/);

    //get observations with restriction (only validated, and validator and remark are not shown)
    const observationsPublic = await getObservations(req, false/*isSuperAdmin*/, false/*onlyOwner*/, false/*onlyUser*/);

    observationsAll = [...observationsUser, ...observationsPublic];

    //CASE 4: user not authenticated
  } else if(!req.user){
    //get observations with restriction (only validated, and validator and remark are not shown)
    observationsAll = await getObservations(req, false/*isSuperAdmin*/, false/*onlyOwner*/, false/*onlyUser*/);
  }
  
  //RETURN
  
  //loop to suppress duplicated values
  const ids = [];
  const observationsUnique = [];
  for (const obs of observationsAll) {
    if (ids.includes(obs.id)) {
      continue;
    }
    ids.push(obs.id);
    observationsUnique.push(obs);
  }

  //order by id
  observationsUnique.sort(function(obs1, obs2) {
    return obs2.id - obs1.id;
  });

  //limit and offset
  const offsetList = req.query.offset || 0;
  const limitList = req.query.limit || 30;

  res.status(200).send(observationsUnique.slice(offsetList).slice(0,limitList));
  return;
  
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
