const models = require("../../models");
const utils = require("../../utils/express");
const { notFoundError } = require("../../utils/errors");

exports.getCountryCode = utils.route(async (req, res) => {
  const longitude = req.params.longitude;
  const latitude = req.params.latitude;

  const queryPromise = await models.countries.findOne({
    attributes: ['iso_a2'],
    where: {
      wkb_geometry: models.sequelize.literal(`st_intersects("wkb_geometry", ST_SetSRID(ST_Point(${longitude}, ${latitude}), 4326))`)
    }
  });

  const result = await utils.handlePromise(queryPromise, {
    message: "Country cannot be retrieved."
  });

  // No result, No country (for example point in the ocean)
  if(!result){
    throw notFoundError(req, req.__('locations.noCountry'));
  }

  res.status(200).send(result.iso_a2);
});

