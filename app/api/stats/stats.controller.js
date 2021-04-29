const models = require("../../models");
const utils = require("../../utils/express");
const { cleanProp } = require("../../utils/params");

exports.count = utils.route(async (req, res) => {
    const whereClause = {
      owner_id: req.query.owner_id
    };
    const cleanedWhereClause = cleanProp(whereClause);

    const queryUsersPromise = models.users.count();
    const queryGeorefPromise = models.images.count({
      where: {
        state: ['waiting_validation', 'validated'],
        ...cleanedWhereClause
      }
    });
    const queryCollectionsPromise = models.collections.count({
      where: cleanedWhereClause
    });
    let query1 = utils.handlePromise(queryUsersPromise, {
      message: "Number of users cannot be retrieved."
    });
    let query2 = utils.handlePromise(queryGeorefPromise, {
      message: "Number of georeferenced images cannot be retrieved."
    });
    let query3 = utils.handlePromise(queryCollectionsPromise, {
      message: "Number of collections cannot be retrieved."
    });
    Promise.all([query1, query2, query3]).then((results) => {
      let stats = {};
      stats.nUsers = results[0];
      stats.nGeoref = results[1];
      stats.nCollections = results[2];
      return res.status(200).send(stats);
    }).catch( error => {
      return res.status(500).send(error);
    });
  });
