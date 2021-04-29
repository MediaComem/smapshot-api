const models = require("../../models");
const utils = require("../../utils/express");
const { inUniqueOrList, cleanProp, getFieldI18n } = require("../../utils/params");

exports.getList = utils.route(async (req, res) => {
  const lang = req.getLocale();
  const whereClause = {
    id: inUniqueOrList(req.query.id)
  };
  const cleanedWhere = cleanProp(whereClause);

  const queryOptions = {
    attributes: ["id", "title", [getFieldI18n('errors_type', 'translations', lang), "translation"]],
    order: [["id", "ASC"]],
    where: cleanedWhere
  };

  const queryPromise = models.errors_type.findAll(queryOptions);

  res.status(201).send(
    await utils.handlePromise(queryPromise, {
      message: "Errors cannot be retrieved."
    })
  );
});
