const models = require("../../models");
const utils = require("../../utils/express");
const { notFoundError } = require("../../utils/errors");

exports.findSetting = utils.route(async (req, res, next) => {
  const { name } = req.params;
  const setting = await models.settings.findOne({ where: { name } });
  if (!setting) {
    throw notFoundError(req);
  }

  
  req.setting = setting;
  next();
});

exports.getByName = utils.route(async (req, res) => {
  res.json(req.setting.value);
});

exports.update = utils.route(async (req, res) => {
  await req.setting.update({ value: req.body });
  res.json(req.setting.value);
});
