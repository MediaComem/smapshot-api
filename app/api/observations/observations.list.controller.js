const Sequelize = require("sequelize");

const models = require("../../models");
const utils = require("../../utils/express");
const { inUniqueOrList, cleanProp, iLikeFormatter, getFieldI18n } = require("../../utils/params");

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

  const whereVolunteers = {
      id: onlyUser ? userId : inUniqueOrList(req.query.volunteer_id), //get observations related to the volunteer role of the user if the option is set to true
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


  const queryPromise = models.observations.findAll({
    attributes,
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
      validator
    ]
  });

  let observations = await utils.handlePromise(queryPromise, {
    message: "Observations cannot be retrieved."
  });

  return observations;
}

exports.getList = utils.route(async (req, res) => {
  const isSuperUser = req.user ? req.user.isSuperAdmin() : false;
  const isOwnerAdmin = req.user ? req.user.isOwnerAdmin() : false;
  const isOwnerValidator = req.user ? req.user.isOwnerValidator() : false;

  //get observations according to the different roles of the user: superAdmin, owner or volunteer

  //CASE 1: user has role super admin
  if(isSuperUser){
    //get all observations with all attributes
    const observationsAll = await getObservations(req, true/*isSuperAdmin*/, false/*onlyOwner*/, false/*onlyUser*/); 
    res.status(200).send(observationsAll);
    return;

  //CASE 2: user has role owner administrator or validator
  } else if(isOwnerAdmin||isOwnerValidator){
    //get all observations related to the volunteer role
    const observationsUser = await getObservations(req, false/*isSuperAdmin*/, false/*onlyOwner*/, true/*onlyUser*/); 

    //get all observations related to the owner role
    const observationsPrivate = await getObservations(req, false/*isSuperAdmin*/, true/*onlyOwner*/, false/*onlyUser*/); 

    //get observations with restriction (only validated state, and validator and remark are not shown)
    const observationsPublic = await getObservations(req, false/*isSuperAdmin*/, false/*onlyOwner*/, false/*onlyUser*/); 

    let observationsAll = [...observationsUser, ...observationsPrivate, ...observationsPublic];
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
    res.status(200).send(observationsUnique);
    return;

    //CASE 3: user is not a super admin or an owner administrator/validator
  } else if(req.user){
    //get all observations related to the volunteer role
    const observationsUser = await getObservations(req, false/*isSuperAdmin*/, false/*onlyOwner*/, true/*onlyUser*/);

    //get observations with restriction (only validated, and validator and remark are not shown)
    const observationsPublic = await getObservations(req, false/*isSuperAdmin*/, false/*onlyOwner*/, false/*onlyUser*/);

    let observationsAll = [...observationsUser, ...observationsPublic];
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
    res.status(200).send(observationsUnique);
    return;

    //CASE 4: user not authenticated
  } else if(!req.user){
    //get observations with restriction (only validated, and validator and remark are not shown)
    const observationsPublic = await getObservations(req, false/*isSuperAdmin*/, false/*onlyOwner*/, false/*onlyUser*/);
    res.status(200).send(observationsPublic);
    return;
  }
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
