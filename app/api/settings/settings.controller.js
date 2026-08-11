const models = require("../../models");
const utils = require("../../utils/express");
const { notFoundError } = require("../../utils/errors");

exports.getByName = utils.route(async (req, res) => {
  const { name } = req.params;

  const setting = await models.settings.findOne({ where: { name } });
  if (!setting) {
    throw notFoundError(req);
  }

  res.json(setting.value);
});
