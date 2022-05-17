const Sequelize = require("sequelize");

const config = require('../../../config');
const models = require("../../models");
const { userHasRole } = require("../../utils/authorization");
const { authorizationError } = require("../../utils/errors");
const utils = require("../../utils/express");
const { inUniqueOrList, cleanProp, getFieldI18n } = require("../../utils/params");
const mediaUtils = require('../../utils/media');

const Op = Sequelize.Op;

exports.getList = utils.route(async (req, res) => {

  const image_width = req.query.image_width ? parseInt(req.query.image_width) : 500;

  const lang = req.getLocale();
  const whereClause = {
    id: inUniqueOrList(req.query.id)
  };

  switch (req.query.publish_state) {
    case 'published':
      whereClause.is_published = true;
      break;
    case 'unpublished':
      if (!userHasRole(req, 'super_admin')) {
        throw authorizationError('Unpublished owners can only be accessed by super administrators');
      }
      whereClause.is_published = false;
      break;
    case 'all':
      if (!userHasRole(req, 'super_admin')) {
        throw authorizationError('Unpublished owners can only be accessed by super administrators');
      }
      break;
    default:
      whereClause.is_published = true;
      break;
  }

  const relevantOwners = await models.owners.findAll({
    attributes:[
      "id",
      "slug",
      [getFieldI18n('owners','name',lang), "name"],
      [getFieldI18n('owners','description',lang), "description"],
      "link",
      "extent",
      [
        models.sequelize.literal(
        `(case
          when banner_id IS NOT NULL
          THEN case
            when iiif_data IS NOT NULL
            THEN case 
              when iiif_data->>'size_info' IS NOT NULL
              THEN json_build_object('banner_url', NULL)
              WHEN iiif_data->>'regionByPx' IS NOT NULL
              THEN json_build_object('banner_url', CONCAT((iiif_data->>'image_service3_url'), '/', regexp_replace(iiif_data->>'regionByPx','[\\[\\]]', '', 'g'),'/${image_width},/0/default.jpg'))
              else json_build_object('banner_url', CONCAT((iiif_data->>'image_service3_url'), '/full/${image_width},/0/default.jpg'))
            end  
            else json_build_object('banner_url', CONCAT('${config.apiUrl}/data/collections/', collection_id,'/images/${image_width === 200 ? 'thumbnails' : image_width}/',banner.id,'.jpg'))
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
        attributes: [
          "iiif_data"
        ]
    }],
    group: ["owners.id", "banner.id"],
    where: cleanProp(whereClause),
    order: [["id", "ASC"]]
  });

  const relevantOwnersIds = relevantOwners.map( owner => owner.dataValues.id );

  const queryCountCollectionsPromise = models.collections.findAll({
    attributes: [
      [ models.sequelize.fn("COUNT", "*"), "nCollections"],
      "owner_id"
    ],
    where: {
      date_publi: { [Op.not]: null },
      owner_id: { [Op.in]: relevantOwnersIds }
    },
    group: ["owner_id"]
  });

  const queryCountImagesPromise = models.images.findAll({
    attributes: [
      [ models.sequelize.fn("COUNT", "*"), "nImages"],
      "owner_id"
    ],
    where: {
      is_published: true,
      owner_id: { [Op.in]: relevantOwnersIds }
    },
    group: ["owner_id"]
  });

  const nImages = {};
  const nCollections = {};
  const results = await Promise.all([queryCountCollectionsPromise, queryCountImagesPromise ]);

  results[0].forEach((result) => {
    const res = result.toJSON();
    nCollections[result.owner_id] = res.nCollections;
  });

  results[1].forEach((result) => {
    const res = result.toJSON();
    nImages[result.owner_id] = res.nImages;
  });

  const owners = relevantOwners.map((result) => {
    return {
      ...result.dataValues,
      owner: result.owner,
      n_images: nImages[result.dataValues.id] || 0,
      n_collections: nCollections[result.dataValues.id] || 0,
      media: result.dataValues.media
    };
  });

  const mediaPromise = [];

  owners.forEach((owner) => {
    if (owner.media && owner.media.banner_url == null &&
        mediaUtils.isIIIFLevel0(owner.banner.dataValues.iiif_data)) {
      mediaPromise.push(mediaUtils.retrieveMediaBannerUrl(owner.media, owner.banner.dataValues.iiif_data.size_info, image_width));
    }
  });

  await Promise.all(mediaPromise);

  owners.forEach((owner) => {
    delete owner.banner;
  });

  return res.send(owners);

});
