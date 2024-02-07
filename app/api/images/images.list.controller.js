const Sequelize = require("sequelize");
const { intersection } = require('lodash');

const models = require("../../models");
const { userHasRole } = require('../../utils/authorization');
const { authorizationError } = require('../../utils/errors');
const utils = require("../../utils/express");
const {
  inUniqueOrList,
  containsUniqueOrList,
  bboxFormater,
  wktFormatter,
  iLikeFormatter,
  cleanProp,
  toUniqueArray
} = require("../../utils/params");
const { getOwnerScope } = require('./images.utils');
const mediaUtils = require('../../utils/media');

const Op = Sequelize.Op;

const parseAttributes = (query) => {
  const basic_attributes = ["id", "original_id", "collection_id", "owner_id", "title", "is_published", "state", "date_georef", "height", "width", "iiif_data"]
  const longitude = [models.sequelize.literal("ST_X(ST_SnapToGrid(location, 0.0001))"), "longitude"];
  const latitude = [models.sequelize.literal("ST_Y(ST_SnapToGrid(location, 0.0001))"), "latitude"];
  const date_shot_min = [
    models.sequelize.literal(
      `(case
        when date_shot IS NOT NULL
        THEN date(date_shot)::TEXT
        else date(date_shot_min)::TEXT
        end)
        `
    ),
    "date_shot_min"
  ];
  const date_shot_max = [
    models.sequelize.literal(
      `(case
        when date_shot IS NOT NULL
        THEN date(date_shot)::TEXT
        else date(date_shot_max)::TEXT
        end)`
    ),
    "date_shot_max"
  ];

  const default_attributes = [
    ...basic_attributes,
    date_shot_min,
    date_shot_max,
    longitude,
    latitude
  ];

  if (!query.attributes) {
    return default_attributes;
  }

  let attributes = intersection(query.attributes, basic_attributes);
  if (query.attributes.includes('longitude')) {
    attributes.push(longitude);
  }
  if (query.attributes.includes('latitude')) {
    attributes.push(latitude);
  }
  if (query.attributes.includes('date_shot_min')) {
    attributes.push(date_shot_min);
  }
  if (query.attributes.includes('date_shot_max')) {
    attributes.push(date_shot_max);
  }
  return attributes;
}

const getImages = async (req, orderkey, count = true) => {
  const query = req.query;
  // TODO add image width for media url
  const attributes = parseAttributes(query);
  const orderBy = orderkey ? orderkey: query.sortKey;
  let whereClauses = [];

  const states = query.state ? query.state : ['waiting_validation', 'validated'];
  whereClauses.push({ state: inUniqueOrList(states) });

  const isGeoref = states.some(state => ['waiting_validation', 'validated'].includes(state));

  switch (query.publish_state) {
    case 'published':
      whereClauses.push({ is_published: true });
      break;
    case 'unpublished': {
      if (!userHasRole(req, 'owner_validator', 'owner_admin', 'super_admin')) {
        throw authorizationError('Unpublished images can only be accessed by respective owners or super administrators');
      }
      const { where: scopeOwner }  = getOwnerScope(req);
      // retrieve only unpublished images
      whereClauses.push({ is_published: false });
      // restrict to current owner
      whereClauses.push(scopeOwner);
      break;
    }
    case 'all': {
      const { where: scopeOwner } = getOwnerScope(req);
      if (!userHasRole(req, 'owner_validator', 'owner_admin', 'super_admin')) {
        throw authorizationError('Unpublished images can only be accessed by respective owners or super administrators');
      }
      if (userHasRole(req, 'super_admin')) {
        // no restriction on is_published - get all images whatever status
      } else {
        // get all published images
        // + unpublished restricted to current owner
        whereClauses.push({
          [Op.or]: [
            { is_published: true },
            scopeOwner
          ]
        });
      }
      break;
    }
    default:
      // only published images by default
      whereClauses.push({ is_published: true });
  }

  if (query.id) {
    whereClauses.push({ id: inUniqueOrList(query.id) });
  }

  if (query.original_id) {
    whereClauses.push({ original_id: inUniqueOrList(query.original_id) });
  }

  if (query.owner_id) {
    whereClauses.push({ owner_id: inUniqueOrList(query.owner_id) });
  }

  if (query.collection_id) {
    whereClauses.push({ collection_id: inUniqueOrList(query.collection_id) });
  }

  if (query.keyword) {
    whereClauses.push({ [Op.or]: {
                          original_id: iLikeFormatter(query.keyword),
                          title: iLikeFormatter(query.keyword),
                          caption: iLikeFormatter(query.keyword)
                        }
                      });
  }

  if (query.user_id) {
    whereClauses.push({ user_id: inUniqueOrList(query.user_id) });
  }

  if (query.place_names) {
    whereClauses.push({ geotags_array: containsUniqueOrList(query.place_names) });
  }

  if (query.date_shot_min || query.date_shot_max) {
    whereClauses.push({
      // Single date
      [Op.or]: {
        date_shot: {
          [Op.and]: {
            [Op.not]: null,
            [Op.gte]: query.date_shot_min,
            [Op.lte]: query.date_shot_max
          },
        },
        // Range of dates
        [Op.and]: {
          date_shot_min: {
            [Op.and]: {
              [Op.not]: null,
              [Op.gte]: query.date_shot_min,
              [Op.lte]: query.date_shot_max
            }
          },
          date_shot_max: {
            [Op.and]: {
              [Op.not]: null,
              [Op.gte]: query.date_shot_min,
              [Op.lte]: query.date_shot_max
            }
          }
        }
      }
    });
  }

  if (query.date_inserted_min) {
    whereClauses.push({
      date_inserted: {
        [Op.gte]: query.date_inserted_min,
      }
    });
  }
  if (query.date_inserted_max) {
    whereClauses.push({
      date_inserted: {
        [Op.lte]: query.date_inserted_max
      }
    });
  }

  if (query.date_georef_min) {
    whereClauses.push({
      date_georef: {
        [Op.gte]: query.date_georef_min,
      }
    });
  }
  if (query.date_georef_max) {
    whereClauses.push({
      date_inserted: {
        [Op.date_georef]: query.date_georef_max
      }
    });
  }

  if (query.date_validated_min) {
    whereClauses.push({
      date_validated: {
        [Op.gte]: query.date_validated_min,
      }
    });
  }
  if (query.date_validated_max) {
    whereClauses.push({
      date_validated: {
        [Op.lte]: query.date_validated_max
      }
    });
  }

  if (isGeoref) {
    if (query.bbox) {
      whereClauses.push({
        location: bboxFormater(query.bbox)
      });
    }
    if (query.wkt_roi) {
      whereClauses.push({
        location: wktFormatter(
                    query.wkt_roi,
                    query.intersect_location || false,
                    query.intersect_footprint || false
                  )
      });
    }
  }


  // Filter locked images
  if (query.only_unlocked) {
    whereClauses.push( models.sequelize.literal(
      "last_start IS NULL OR (EXTRACT(EPOCH FROM now())-EXTRACT(EPOCH FROM last_start))/60 >= 240"
    ));
  }

  const today = new Date();
  today.setHours(23);
  today.setMinutes(59);

  const includeCollectionFilter = {
    model: models.collections,
    attributes: [],
    where: {
      date_publi: {
        [Op.not]: null,
        [Op.lte]: today // future publish date is not yet published
      },
    }
  };

  const randomOrder = models.sequelize.literal("random()");

  if (!isGeoref) {
    let whereClauseApriori = {}
    let includeOption = null;

    if (query.bbox) {
      whereClauseApriori = {
        geom: {
          [Op.and]: [
            bboxFormater(query.bbox || false)
          ]
        }
      }
    }

    let orderByApriori;

    if (!query.longitude || !query.latitude) {
      orderByApriori = undefined;
    } else {
      orderByApriori = models.sequelize.literal(`apriori_locations.geom <-> st_setsrid(ST_makepoint(${query.longitude}, ${query.latitude}), 4326)`);
    }

    const orderById = [["id"]];
    includeOption = [{
      model: models.apriori_locations,
      attributes: [
        [models.sequelize.literal("ST_X(geom)"), "longitude"],
        [models.sequelize.literal("ST_Y(geom)"), "latitude"],
        "exact"
      ],
      where: whereClauseApriori,
      required: true,
      duplicating: false,
      order: orderBy === 'distance' ? orderByApriori : undefined
    },
    includeCollectionFilter
  ];
    const sequelizeQuery = {
      subQuery: false,
      attributes: attributes,
      limit: query.limit || 30,
      offset: query.offset || 0,
      where: { [Op.and]: whereClauses },
      order: orderBy === 'id' ? orderById : (orderBy === 'random' ? randomOrder : orderByApriori),
      include: includeOption
    };
    if (count) {
      const response = await models.images.findAndCountAll(sequelizeQuery);
      // Count the total number of images matching the query
      const countPromise = await models.images.count({
        where: { [Op.and]: whereClauses },
        include: includeOption,
        distinct: 'images.id'
      })
      response.count = countPromise
      return response;
    } else {
      const response = await models.images.findAll(sequelizeQuery);
      return response;
    }
  } else {
    const orderByNearest = models.sequelize.literal(`images.location <-> st_setsrid(ST_makepoint(${query.longitude}, ${query.latitude}), 4326)`);
    const orderById = [["id"]];
    const sequelizeQuery = {
      subQuery: false,
      attributes: attributes,
      limit: query.limit || 30,
      offset: query.offset || 0,
      where: { [Op.and]: whereClauses },
      order: orderBy === 'distance' ? orderByNearest : (orderBy === 'random' ? randomOrder : orderById),
      include: [includeCollectionFilter]
    };
    if (count) {
      const response = await models.images.findAndCountAll(sequelizeQuery);
      return response;
    } else {
      const response = await models.images.findAll(sequelizeQuery);
      return response;
    }
  }
};

exports.getList = utils.route(async (req, res) => {  
  const images = await getImages(req);
  //Build media
  if (!req.query.attributes || req.query.attributes.includes('media')) { //only return media if no specific attributes requested or if media requested
    if(images.rows) {
      await mediaUtils.setListImageUrl(images.rows, /* image_width */ 200, /* image_height */ null);
    }
    images.rows.forEach((image) => {
      delete image.dataValues.iiif_data;
    });
  }

  res.status(200).send(images);
});

exports.getListId = utils.route(async (req, res) => {
  req.query = { ...req.query, attributes: ["id"] };
  const images = await getImages(req, /*orderBy*/ 'id', /*count*/ false);

  // Send flattened objects
  res.status(200).send(images.map(obj => obj.id));
});

exports.getListMetadata = utils.route(async (req, res) => {
  let ownerIds;
  const user = req.user;
  const requestedOwnerIds = req.query.owner_id ? toUniqueArray(req.query.owner_id) : undefined;
  if (user.isSuperAdmin()) {
    // A super administrator can request image metadata for any owner (or access
    // all images).
    ownerIds = requestedOwnerIds;
  } else if (user.hasRole('owner_admin') || user.hasRole('owner_validator')) {
    // An owner administrator or validator can only request image metadata for
    // their owner.
    const accessibleOwnerIds = [ user.owner_id ];
    ownerIds = requestedOwnerIds ? intersection(requestedOwnerIds, accessibleOwnerIds) : accessibleOwnerIds;
    if (requestedOwnerIds && ownerIds.length !== requestedOwnerIds.length) {
      throw authorizationError('An owner validator or administrator can only access metadata for images linked to the same owner');
    }
  } else {
    throw new Error(`Cannot determine owner scope for user ${user.id} with unsupported role(s) ${user.roles.join(', ')}`);
  }

  const whereImages = {
    id: inUniqueOrList(req.query.id),
    owner_id: inUniqueOrList(ownerIds),
    collection_id: inUniqueOrList(req.query.collection_id),
    original_id: inUniqueOrList(req.query.original_id),
    date_validated: {
      [Op.gte]: req.query.date_validated_min,
      [Op.lte]: req.query.date_validated_max
    }
  };

  const cleanedWhere = cleanProp(whereImages);

  // Include geolocation information and toponyms if geolocalisation is true
  const includeGeoloc = [
  {
    model: models.geolocalisations,
    attributes: [
      [models.sequelize.literal("st_X(geolocalisation.location)"), "longitude"],
      [models.sequelize.literal("st_Y(geolocalisation.location)"), "latitude"],
      [models.sequelize.literal("st_Z(geolocalisation.location)"), "altitude"],
      "azimuth",
      "tilt",
      "roll",
      "focal",
      [models.sequelize.literal("st_AsText(geolocalisation.location)"), "point"],
      [models.sequelize.literal("st_AsText(geolocalisation.footprint)"), "footprint"],
    ],
    where: { state: 'validated' },
    required: false
  },
  {
    model: models.geometadata,
    attributes: [],
    required: false
  }];

  const countTotal = await models.images.count({
    where: cleanedWhere
  });

  const attributes = [
    "id",
    "original_id",
    "collection_id",
    "owner_id",
    "state",
    "title",
    "caption",
    "link",
    [models.sequelize.literal("ST_X(images.location)"), "longitude"],
    [models.sequelize.literal("ST_Y(images.location)"), "latitude"]
  ];

  if (req.query.geolocalisation) {
    attributes.push([Sequelize.col('geometadatum.toponyms_array'), 'geotags_array'])
    attributes.push([Sequelize.col('geometadatum.toponyms_json'), 'geotags_json'])
  }

  const images = await models.images.findAll({
    attributes: attributes,
    limit: req.query.limit || 30,
    offset: req.query.offset || 0,
    where: cleanedWhere,
    order: [["id"]],
    include: req.query.geolocalisation ? includeGeoloc : null
  });

  res.header('Total-Items', countTotal).status(200).send(images);
});

exports.getStats = utils.route(async (req, res) => {
  let whereImages = {
    owner_id: inUniqueOrList(req.query.owner_id),
    collection_id: inUniqueOrList(req.query.collection_id),
    photographer_id: inUniqueOrList(req.query.photographer_id),
    validator_id: inUniqueOrList(req.query.validator_id),
    user_id: inUniqueOrList(req.query.user_id),
    ...(req.query.date_shot_min || req.query.date_shot_max
      ?
      {
        // Single date
        [Op.or]: {
          date_shot: {
            [Op.and]: {
              [Op.not]: null,
              [Op.gte]: req.query.date_shot_min,
              [Op.lte]: req.query.date_shot_max
            },
          },
          // Range of dates
          [Op.and]: {
            date_shot_min: {
              [Op.and]: {
                [Op.not]: null,
                [Op.gte]: req.query.date_shot_min,
                [Op.lte]: req.query.date_shot_max
              }
            },
            date_shot_max: {
              [Op.and]: {
                [Op.not]: null,
                [Op.gte]: req.query.date_shot_min,
                [Op.lte]: req.query.date_shot_max
              }
            }
          }
        }
      }
      : {}),
    date_inserted: {
      [Op.gte]: req.query.date_inserted_min,
      [Op.lte]: req.query.date_inserted_max
    },
    date_georef: {
      [Op.gte]: req.query.date_georef_min,
      [Op.lte]: req.query.date_georef_max
    },
    date_validated: {
      [Op.gte]: req.query.date_validated_min,
      [Op.lte]: req.query.date_validated_max
    }
  };

  const cleanedWhere = cleanProp(whereImages);

  const queryPromise = models.images.findAll({
    attributes: [
      "state",
      [models.sequelize.fn("COUNT", "id"), "count"]
    ],
    where: cleanedWhere,
    group: ["state"]
  });

  const result = await utils.handlePromise(queryPromise, {
    message: "Images cannot be retrieved."
  });

  res.status(200).send({
    count: result.reduce((a, b) => a + b.get({ plain: true }).count, 0),
    rows: result
  });
});
