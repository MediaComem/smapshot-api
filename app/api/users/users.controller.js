const Sequelize = require("sequelize");

const models = require("../../models");
const utils = require("../../utils/express");
const { cleanProp, inUniqueOrList, toArray } = require("../../utils/params");

const Op = Sequelize.Op;

exports.getList = utils.route(async (req, res) => {

  const { include, whereClauses } = await getUsersScope(req.user);

  if (req.query.email) {
    whereClauses.push({
      [Op.or]: toArray(req.query.email).map(email => ({ email: { [Op.iLike]: email }}))
    });
  }

  if (req.query.language) {
    whereClauses.push({ lang: req.query.language });
  }

  if (req.query.letter) {
    whereClauses.push({ letter: req.query.letter });
  }

  if (req.query.username) {
    whereClauses.push({
      [Op.or]: toArray(req.query.username).map(username => ({ username: { [Op.iLike]: `%${username.trim()}%` }}))
    });
  }

  const users = await models.users.findAll({
    attributes: [
      'id', 'first_name', 'last_name', 'email', 'username',
      'date_registr', 'letter', 'lang', 'has_one_validated', 'roles', 'owner_id'
    ],
    include,
    where: { [Op.and]: whereClauses },
    order: [
      [ 'username', 'ASC' ],
      [ 'id', 'ASC' ]
    ]
  });

  res.status(200).send(users);
});

const retrieveGeoCount = async (whereGeoloc, whereImages, userIds) => {
  let includes = [
    {
      attributes: ['id', 'username'],
      model: models.users,
      where: {id: { [Op.in]: userIds } },
      as: 'volunteer',
      required: true
    }
  ];
  if (whereImages) {
    includes.push({
      attributes: [],
      model: models.images,
      where: cleanProp(whereImages),
      required: true
    });
  }
  return models.geolocalisations.findAll({
    attributes: [
      [ models.sequelize.literal('count(geolocalisations.id)'), "count" ],
    ],
    where: cleanProp(whereGeoloc),
    include: includes,
    group: 'volunteer.id'
  });
}

const retrieveCorrCount = async (whereCorr, whereImages, userIds) => {
  let includes = [
    {
      attributes: ['id', 'username'],
      model: models.users,
      where: {id: { [Op.in]: userIds } },
      as: 'volunteer',
      required: true
    }
  ];
  if (whereImages) {
    includes.push({
      attributes: [],
      model: models.images,
      where: cleanProp(whereImages),
      required: true
    });
  }
  return models.corrections.findAll({
    attributes: [
      [ models.sequelize.literal('count(corrections.id)'), "count" ]
    ],
    where: cleanProp(whereCorr),
    include: includes,
    group: 'volunteer.id'
  });
}

const retrieveObsCount = async (whereObs, whereImages, userIds) => {
  let includes = [
    {
      attributes: ['id', 'username'],
      where: {id: { [Op.in]: userIds } },
      model: models.users,
      as: 'volunteer',
      required: true
    }
  ];
  if (whereImages) {
    includes.push({
      attributes: [],
      model: models.images,
      where: cleanProp(whereImages),
      required: true
    });
  }
  return models.observations.findAll({
    attributes: [
      [ models.sequelize.literal('count(observations.id)'), "count" ]
    ],
    where: cleanProp(whereObs),
    include: includes,
    group: 'volunteer.id'
  });
}

exports.getRanking = utils.route(async (req, res) => {

  const order_by = req.query.order_by || 'n_geoloc';

  /* Images conditions for Geoloc, Observations, Corrections */
  let whereImages;
  if (req.query.owner_id || req.query.collection_id) {
    whereImages = {
      owner_id: inUniqueOrList(req.query.owner_id),
      collection_id: inUniqueOrList(req.query.collection_id)
    };
  }

  let includes = [
    {
      attributes: ['id', 'username'],
      model: models.users,
      as: 'volunteer',
      required: true
    }
  ];
  if (whereImages) {
    includes.push({
      attributes: [],
      model: models.images,
      where: cleanProp(whereImages),
      required: true
    });
  }

  /* Geolocalisation Conditions */
  const whereGeoloc = {
    date_georef: {
      [Op.gte]: req.query.date_min,
      [Op.lte]: req.query.date_max
    },
    stop: {
      [Op.ne]: null // do not count non finalized geolocalisation trial
    },
    state: ['waiting_validation', 'validated']
  }

  /* Corrections Conditions */
  const whereCorr = {
    date_created: {
      [Op.gte]: req.query.date_min,
      [Op.lte]: req.query.date_max
    },
    state: ['created', 'accepted']
  }

  /* Observations Conditions */
  const whereObs = {
    date_created: {
      [Op.gte]: req.query.date_min,
      [Op.lte]: req.query.date_max
    },
    state: ['created', 'validated']
  }

  // We first get all users that are active for the selected filters and ordered them by the selected order option
  // Then we will count other contribution only for the top users corresponding to limit/offset
  // For instance: ?limit=5&collection_id=2
  // 1. We count all geolocalisations of all user for collection 2 (intensive query) and get top 5 users
  // 2. We count observations and vorrections only for the 5 top users (and not all users for collections 2)
  let topUsers;
  switch(order_by) {
    case 'n_geoloc':
      topUsers = await models.geolocalisations.findAll({
        attributes: [
          [ models.sequelize.literal('count(geolocalisations.id)'), "n_geoloc" ],
          [ models.sequelize.literal('geolocalisations.user_id'), "active_user_id" ]
        ],
        where: cleanProp(whereGeoloc),
        include: includes,
        group: ['active_user_id', 'volunteer.id'],
        order: [[models.sequelize.literal('"n_geoloc"'), req.query.order_dir || "DESC"]]
      });
    break;
    case 'n_corr':
      topUsers = await models.corrections.findAll({
        attributes: [
          [ models.sequelize.literal('COUNT(corrections.id)'), 'n_corr'],
          [ models.sequelize.literal('corrections.user_id'), "active_user_id" ]
        ],
        where: cleanProp(whereCorr),
        include: includes,
        group: ['active_user_id', 'volunteer.id'],
        order: [[models.sequelize.literal('"n_corr"'), req.query.order_dir || "DESC"]]
      });
    break;
    case 'n_obs':
      topUsers = await models.observations.findAll({
        attributes: [
          [ models.sequelize.literal('COUNT(observations.id)'), 'n_obs'],
          [ models.sequelize.literal('observations.user_id'), "active_user_id" ]
        ],
        where: cleanProp(whereObs),
        include:includes,
        group: ['active_user_id', 'volunteer.id'],
        order: [[models.sequelize.literal('"n_obs"'), req.query.order_dir || "DESC"]]
      });
    break;
  }

  const offset = req.query.offset || 0;
  const endOffset = offset + (req.query.limit || 30);
  const activeUsers = topUsers.slice(offset, endOffset);
  const activeUsersIds = activeUsers.map ( user => user.dataValues.active_user_id );

  let ranking = { count: topUsers.length, rows: [] };
  let rows = activeUsers.map( result => {
    const res = result.toJSON();
    return {
      id: res.active_user_id,
      username: res.volunteer.username,
      n_geoloc: res.n_geoloc,
      n_corr: res.n_corr,
      n_obs: res.n_obs }
  });
  let results = [];
  let geolocalisations = {};
  let corrections = {};
  let observations = {};

  let queryGeo;
  let queryCorr;
  let QueryObs;

  switch(order_by) {
    case 'n_geoloc':
      queryCorr = retrieveCorrCount(whereCorr, whereImages, activeUsersIds);
      QueryObs = retrieveObsCount(whereObs, whereImages, activeUsersIds);
      results = await Promise.all([ queryCorr, QueryObs ]);
      results[0].forEach((result) => {
        const res = result.toJSON();
        corrections[res.volunteer.id] = res.count;
      });
      results[1].forEach((result) => {
        const res = result.toJSON();
        observations[res.volunteer.id] = res.count;
      });
      rows.forEach((row) => {
        row.n_corr = corrections[row.id] || 0;
        row.n_obs = observations[row.id] || 0;
      })
    break;
    case 'n_corr':
      queryGeo = retrieveGeoCount(whereGeoloc, whereImages, activeUsersIds)
      QueryObs = retrieveObsCount(whereObs, whereImages, activeUsersIds);
      results = await Promise.all([ queryGeo, QueryObs ]);
      results[0].forEach((result) => {
        const res = result.toJSON();
        geolocalisations[res.volunteer.id] = res.count;
      });
      results[1].forEach((result) => {
        const res = result.toJSON();
        observations[res.volunteer.id] = res.count;
      });
      rows.forEach((row) => {
        row.n_geoloc = geolocalisations[row.id] || 0;
        row.n_obs = observations[row.id] || 0;
      })
      break;
    case 'n_obs':
      queryGeo = retrieveGeoCount(whereGeoloc, whereImages, activeUsersIds)
      queryCorr = retrieveCorrCount(whereCorr, whereImages, activeUsersIds);
      results = await Promise.all([ queryGeo, queryCorr ]);
      results[0].forEach((result) => {
        const res = result.toJSON();
        geolocalisations[res.volunteer.id] = res.count;
      });
      results[1].forEach((result) => {
        const res = result.toJSON();
        corrections[res.volunteer.id] = res.count;
      });
      rows.forEach((row) => {
        row.n_geoloc = geolocalisations[row.id] || 0;
        row.n_corr = corrections[row.id] || 0;
      })
    break;
  }
  ranking.rows = rows;
  res.status(200).send(ranking);
});

/**
 * Returns the query scope that represents the users accessible by the
 * authenticated user.
 *
 * @param {models.users} user - The authenticated user.
 * @returns {Object} Array of user ids accessible for that user.
 */
async function getUsersScope(user) {

  const include = [];
  const whereClauses = [];

  // If the authenticated user is not a super administrator, the only accessible
  // users are those who have participated on images owned by the same owner as
  // the authenticated user's.
  if (!user.isSuperAdmin()) {
    let ownerEmployeeIds = [];
    // Owner admin can also see owner employees (validator, admins for that owner)
    if (user.hasRole('owner_admin')) {
      const ownerEmployees = await models.users.findAll({
        attributes: [ "id" ],
        where: { owner_id: user.owner_id }
      });
      ownerEmployeeIds = ownerEmployees.map(user => user.dataValues.id);
    }
    // select users that have some validated geolocalisations for that owner
    const georeferencers = await models.images.findAll({
      attributes: [[models.sequelize.literal('distinct(user_id)'), "id"]],
      where: {
        user_id: { [Op.not]: null},
        owner_id: user.owner_id
      }
    });
    const georeferencersIds = georeferencers.map(user => user.dataValues.id);
    // user can always see himself
    whereClauses.push({ id: { [Op.in]: [ user.id, ...ownerEmployeeIds, ...georeferencersIds ] } });
  }
  return { include, whereClauses };

}
