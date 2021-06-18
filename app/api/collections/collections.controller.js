const Sequelize = require("sequelize");

const models = require("../../models");
const { userHasRole } = require("../../utils/authorization");
const { getOwnerScope } = require('./collections.utils');
const { authorizationError, notFoundError } = require("../../utils/errors");
const { route } = require("../../utils/express");
const { inUniqueOrList, cleanProp, getFieldI18n, parseBooleanQueryParam } = require("../../utils/params");
const config = require('../../../config');

const Op = Sequelize.Op;


const getCollections = async (req, res) => {
  const lang = req.getLocale();
  const image_width = req.query.image_width ? parseInt(req.query.image_width) : 500;
  const today = new Date();
  today.setHours(23);
  today.setMinutes(59);

  const whereClausePublic = {
    date_publi: {
      [Op.not]: null,
      [Op.lte]: today // future publish date is not yet published
    },
    is_owner_challenge: parseBooleanQueryParam(req.query.is_challenge),
    is_main_challenge: parseBooleanQueryParam(req.query.is_main_challenge),
    owner_id: inUniqueOrList(req.query.owner_id)
  };

  let whereClause = whereClausePublic;

  switch (req.query.publish_state) {
    case 'published':
      whereClause = whereClausePublic;
      break;
    case 'unpublished': {
      if (!userHasRole(req, 'owner_validator', 'owner_admin', 'super_admin')) {
        throw authorizationError('Unpublished collections can only be accessed by respective owner or super administrators');
      }
      const { include: scopeOwner } = getOwnerScope(req);
      // retrieve only unpublished collections including those with future publish date
      // restrict to current owner
      whereClause = {
        ...whereClausePublic,
        date_publi: {
          [Op.or]: {
            [Op.eq]: null,
            [Op.gte]: today
          }
        },
        ...scopeOwner
      };
      break;
    }
    case 'all': {
      if (!userHasRole(req, 'owner_validator', 'owner_admin', 'super_admin')) {
        throw authorizationError('Unpublished collections can only be accessed by respective owner or super administrators');
      }
      if (userHasRole(req, 'super_admin')) {
        // get all collections whatever date_publi
        whereClause = {
          is_owner_challenge: whereClausePublic.is_owner_challenge,
          is_main_challenge: whereClausePublic.is_main_challenge,
          owner_id: whereClausePublic.owner_id
        };
      } else {
        const { include: scopeOwner } = getOwnerScope(req);
        // get all published collections
        // + unpublished restricted to current owner including those with future publish date
        whereClause = {
          is_owner_challenge: whereClausePublic.is_owner_challenge,
          is_main_challenge: whereClausePublic.is_main_challenge,
          owner_id: whereClausePublic.owner_id,
          [Op.or]: {
            date_publi: { 
              [Op.not]: null,
              [Op.lte]: today
            }, // only published collections
            ...scopeOwner                   // or collections from the owner id
          }
        };
      }
      break;
    }
  }


  // TODO update once iiif server from imagineRio support full region
  const collections = await models.collections.findAll({
    attributes: [
      "id",
      [getFieldI18n('collections', 'name', lang), "name"],
      "link",
      [getFieldI18n('collections', 'description', lang), "description"],
      "date_publi",
      [
        models.sequelize.literal(
        `(case
          when banner_id IS NOT NULL
            THEN case
              when banner.iiif_data IS NOT NULL
              THEN json_build_object('banner_url', CONCAT((banner.iiif_data->>'image_service3_url'), '/full/${image_width},/0/default.jpg'))
              else json_build_object('banner_url', CONCAT('${config.apiUrl}/data/collections/', collections.id,'/images/${image_width === 200 ? 'thumbnails' : image_width}/', collections.banner_id,'.jpg'))
            end
            else null
          end)`
        ),
        "media"
      ]
    ],
    include:[{
        model: models.images,
        as: "banner",
        attributes: []
      }],
    where: cleanProp(whereClause),
    order: [
      [ 'date_publi', 'ASC' ],
      [ 'id', 'ASC' ]
    ]
  });

  return res.send(collections);
};

exports.getList = route(async (req, res) => {
  const image_width = req.query.image_width ? parseInt(req.query.image_width) : 500;

  const retrieveExtraInformation = parseBooleanQueryParam(req.query.extra_info, true);
  if (!retrieveExtraInformation) {
    // return only collection list (do not include number of images and georef images)
    return getCollections(req, res);
  }

  const lang = req.getLocale();
  const today = new Date();
  today.setHours(23);
  today.setMinutes(59);
  
  const whereClausePublic = {
    date_publi: {
      [Op.not]: null,
      [Op.lte]: today // future publish date is not yet published
    },
    is_owner_challenge: parseBooleanQueryParam(req.query.is_challenge),
    is_main_challenge: parseBooleanQueryParam(req.query.is_main_challenge),
    owner_id: inUniqueOrList(req.query.owner_id)
  };

  let whereClause = whereClausePublic;

  switch (req.query.publish_state) {
    case 'published':
      whereClause = whereClausePublic;
      break;
    case 'unpublished': {
      if (!userHasRole(req, 'owner_validator', 'owner_admin', 'super_admin')) {
        throw authorizationError('Unpublished collections can only be accessed by respective owner or super administrators');
      }
      const { include: scopeOwner } = getOwnerScope(req);
      // retrieve only unpublished collections including those with future publish date
      // restrict to current owner
      whereClause = {
        ...whereClausePublic,
        date_publi: {
          [Op.or]: {
            [Op.eq]: null,
            [Op.gte]: today
          }
        },
        ...scopeOwner
      };
      break;
    }
    case 'all': {
      if (!userHasRole(req, 'owner_validator', 'owner_admin', 'super_admin')) {
        throw authorizationError('Unpublished collections can only be accessed by respective owner or super administrators');
      }
      if (userHasRole(req, 'super_admin')) {
        // get all collections whatever date_publi
        whereClause = {
          is_owner_challenge: whereClausePublic.is_owner_challenge,
          is_main_challenge: whereClausePublic.is_main_challenge,
          owner_id: whereClausePublic.owner_id
        };
      } else {
        const { include: scopeOwner } = getOwnerScope(req);
        // get all published collections
        // + unpublished restricted to current owner including those with future publish date
        whereClause = {
          is_owner_challenge: whereClausePublic.is_owner_challenge,
          is_main_challenge: whereClausePublic.is_main_challenge,
          owner_id: whereClausePublic.owner_id,
          [Op.or]: {
            date_publi: {
              [Op.not]: null, // only published collections
              [Op.lte]: today // excluding future published date
            }, 
            ...scopeOwner                   // or collections from the owner id
          }
        };
      }

      break;
    }
  }

  const relevantCollections = await models.collections.findAll({
    attributes: [
      "id",
      [getFieldI18n('collections', 'name', lang), "name"],
      "link",
      [getFieldI18n('collections', 'description', lang), "description"],
      "date_publi",
      [
        models.sequelize.literal(
        `(case
          when collections.banner_id IS NOT NULL
            THEN case
              when banner.iiif_data IS NOT NULL
              THEN json_build_object('banner_url', CONCAT((banner.iiif_data->>'image_service3_url'), '/full/${image_width},/0/default.jpg'))
              else json_build_object('banner_url', CONCAT('${config.apiUrl}/data/collections/', collections.id,'/images/${image_width === 200 ? 'thumbnails' : image_width}/', collections.banner_id,'.jpg'))
            end
            else null
          end)`
        ),
        "media"
      ]
    ],
    include:[{
        model: models.images,
        as: "banner",
        attributes: []
      },
      {
        model: models.owners,
        attributes: ["id", [getFieldI18n('owner', 'name', lang), "name"], "slug"]
    }],
    where: cleanProp(whereClause),
    order: [
      [ 'date_publi', 'ASC' ],
      [ 'id', 'ASC' ]
    ]
  });

  const relevantCollectionsIds = relevantCollections.map( collection => collection.dataValues.id);

  const queryAllPromise = models.images.findAll({
    attributes: [
      [ models.sequelize.fn("COUNT", "*"), "nImages"],
      "collection_id"
    ],
    where: {
      is_published: true,
      collection_id: { [Op.in]: relevantCollectionsIds }
    },
    group: ["collection_id"]
  });

  const queryGeorefPromise = models.images.findAll({
    attributes: [
      [ models.sequelize.fn("COUNT", "*"), "nGeoref"],
      "collection_id"
    ],
    where: {
      state: ["waiting_validation", "validated"],
      is_published: true,
      collection_id: { [Op.in]: relevantCollectionsIds }
    },
     group: ["images.collection_id"]
  });

  const nGeoref = {};
  const nImages = {};
  const results = await Promise.all([queryAllPromise, queryGeorefPromise ]);

  results[0].forEach((result) => {
    const res = result.toJSON();
    nImages[result.collection_id] = res.nImages;
  });

  results[1].forEach((result) => {
    const res = result.toJSON();
    nGeoref[result.collection_id] = res.nGeoref;
  });

  const collections = relevantCollections.map((result) => {
    return {
      ...result.dataValues,
      owner: result.owner,
      nImages: nImages[result.dataValues.id],
      nGeoref: nGeoref[result.dataValues.id] || 0,
      media: result.dataValues.media
    };
  });

  return res.send(collections.filter(collection => collection.nImages));
});

exports.getById = route(async (req, res) => {
  const image_width = req.query.image_width ? parseInt(req.query.image_width) : 500;
  const lang = req.getLocale();

  const where = {
    id: req.params.id
  };

  // Details of unpublished collections can only be accessed by super administrators.
  const today = new Date().toISOString().split('T')[0];
  if (!userHasRole(req, 'super_admin')) {
    where.date_publi = { 
      [Op.not]: null,
      [Op.lte]: today };
  }

  const collectionPromise = models.collections.findOne({
    attributes: [
      'id',
      [getFieldI18n('collections', 'name', lang), 'name'],
      'link',
      [getFieldI18n('collections', 'description', lang), 'description'],
      'date_publi',
      'banner_id',
      [ models.sequelize.fn('COUNT', 'image.id'), 'nImages']
    ],
    include: [
      {
        model: models.images,
        attributes: []
      },
      {
        model: models.owners,
        attributes: [
          "id",
          [getFieldI18n('owner', 'name', lang), "name"],
          "slug"
        ]
      }
    ],
    group: [ 'collections.id', 'owner.id' ],
    where
  });

  const georefPromise = models.collections.findOne({
    attributes: [
      [ models.sequelize.fn('COUNT', 'georef.id'), 'nGeoref']
    ],
    include: [
      {
        model: models.images,
        as: 'georeferenced_images',
        attributes: []
      }
    ],
    group: [ 'collections.id' ],
    where
  });

  const mediaPromise = models.collections.findOne({
    attributes: [
      [
        models.sequelize.literal(
        `(case
          when iiif_data IS NOT NULL
          THEN json_build_object('banner_url', CONCAT((iiif_data->>'image_service3_url'), '/full/200,/0/default.jpg'))
          else json_build_object('banner_url', CONCAT('${config.apiUrl}/data/collections/', collections.id,'/images/${image_width === 200 ? 'thumbnails' : image_width}/', collections.banner_id,'.jpg'))
          end)`
        ),
        "media"
      ]
    ],
    include:[{
      model: models.images,
      as: "banner",
      attributes: ["id"]
    }],
    where
  });

  const [ collection, georef, media ] = await Promise.all([ collectionPromise, georefPromise, mediaPromise ]);
  if (!collection) {
    throw notFoundError(req);
  }

  res.send({
    id: collection.id,
    name: collection.name,
    link: collection.link,
    owner: collection.owner,
    description: collection.description,
    date_publi: collection.date_publi,
    nImages: collection.get('nImages'),
    nGeoref: georef.get('nGeoref'),
    media: media.get('media')
  });
});
