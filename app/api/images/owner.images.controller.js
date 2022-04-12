const groupArray = require('group-array');
const Sequelize = require("sequelize");

const config = require('../../../config');
const models = require("../../models");
const { userHasRole } = require("../../utils/authorization");
const { notFoundError } = require("../../utils/errors");
const utils = require("../../utils/express");
const { getWhereOwnerIdOrSlug, getFieldI18n } = require("../../utils/params");

const Op = Sequelize.Op;

exports.getAttributes = utils.route(async (req, res) => {
    const lang = req.getLocale();
    const whereOwner = getWhereOwnerIdOrSlug(req.params.owner_id_slug);

    const attributes = [
        "id",
        "is_published",
        "original_id",
        "title",
        "caption",
        "license",
        "download_link",
        "link",
        "shop_link",
        "observation_enabled",
        "correction_enabled",
        "state",
        "apriori_altitude",
        "view_type",
        "azimuth",
        "tilt",
        "roll",
        "focal",
        'width',
        'height',
        'country_iso_a2',
        'framing_mode',
        [models.sequelize.literal("ST_X(images.location)"), "longitude"],
        [models.sequelize.literal("ST_Y(images.location)"), "latitude"],
        [models.sequelize.literal("ST_Z(images.location)"), "altitude"],
        [
          models.sequelize.literal(
            `(case
              when date_shot IS NOT NULL
              THEN date(date_shot)::TEXT
              else date(date_shot_min)::TEXT
              end)
              `
          ),
          "date_shot_min"
        ],
        [
          models.sequelize.literal(
            `(case
              when date_shot IS NOT NULL
              THEN date(date_shot)::TEXT
              else date(date_shot_max)::TEXT
              end)`
          ),
          "date_shot_max"
        ],
        [models.sequelize.literal("(EXTRACT(EPOCH FROM now())-EXTRACT(EPOCH FROM last_start))/60"), "delta_last_start"],
        [
          models.sequelize.literal(`
              CASE
                WHEN
                (DATE_PART('day', now()::timestamp - last_start::timestamp) * 24 * 60
                + DATE_PART('hour', now()::timestamp - last_start::timestamp) * 60
                + DATE_PART('minute', now()::timestamp - last_start::timestamp)) < 120
                THEN TRUE
                ELSE FALSE
              END
              `),
          "locked"
        ],
        ["last_start_user_id", "locked_user_id"],
        [ models.sequelize.fn("COUNT", models.sequelize.col("observations.*")), "nObs"],
        [
          models.sequelize.literal(
          `(CASE
            WHEN iiif_data IS NOT NULL AND (images.state = 'validated' OR images.state = 'waiting_validation')
                THEN case 
                  WHEN iiif_data->>'size_info' IS NOT NULL
                    THEN json_build_object('image_url', NULL,
                                        'tiles', json_build_object('type', 'iiif', 'url', CONCAT(iiif_data->>'image_service3_url', '/info.json')),
                                        'model_3d_url', CONCAT('${config.apiUrl}/data/collections/', collection_id,'/gltf/',images.id,'.gltf'))
                    WHEN iiif_data->>'regionByPx' IS NOT NULL AND geolocalisation.region_px IS NOT NULL
                      THEN json_build_object('image_url', CONCAT((iiif_data->>'image_service3_url'), '/', regexp_replace(iiif_data->>'regionByPx','[\\[\\]]', '', 'g'),'/200,/0/default.jpg'),
                                                        'tiles', json_build_object('type', 'iiif', 'url', CONCAT(iiif_data->>'image_service3_url', '/info.json')),
                                                        'model_3d_url', CONCAT('${config.apiUrl}/data/collections/', collection_id,'/gltf/',images.id, '_', geolocalisation.region_px[1], '_', geolocalisation.region_px[2], '_', geolocalisation.region_px[3], '_', geolocalisation.region_px[4], '.gltf'),
                                                        'regionByPx', iiif_data->'regionByPx')
                    WHEN iiif_data->>'regionByPx' IS NOT NULL AND geolocalisation.region_px IS NULL
                      THEN json_build_object('image_url', CONCAT((iiif_data->>'image_service3_url'), '/', regexp_replace(iiif_data->>'regionByPx','[\\[\\]]', '', 'g'),'/200,/0/default.jpg'),
                                        'tiles', json_build_object('type', 'iiif', 'url', CONCAT(iiif_data->>'image_service3_url', '/info.json')),
                                        'model_3d_url', CONCAT('${config.apiUrl}/data/collections/', collection_id,'/gltf/',images.id,'.gltf'),
                                        'regionByPx', iiif_data->'regionByPx')
                    WHEN iiif_data->>'regionByPx' IS NULL AND geolocalisation.region_px IS NOT NULL
                      THEN json_build_object('image_url', CONCAT((iiif_data->>'image_service3_url'), '/full/200,/0/default.jpg'),
                                        'tiles', json_build_object('type', 'iiif', 'url', CONCAT(iiif_data->>'image_service3_url', '/info.json')),
                                        'model_3d_url', CONCAT('${config.apiUrl}/data/collections/', collection_id,'/gltf/',images.id, '_', geolocalisation.region_px[1], '_', geolocalisation.region_px[2], '_', geolocalisation.region_px[3], '_', geolocalisation.region_px[4], '.gltf'))
                    ELSE json_build_object('image_url', CONCAT((iiif_data->>'image_service3_url'), '/full/200,/0/default.jpg'),
                                       'tiles', json_build_object('type', 'iiif', 'url', CONCAT(iiif_data->>'image_service3_url', '/info.json')),
                                       'model_3d_url', CONCAT('${config.apiUrl}/data/collections/', collection_id,'/gltf/',images.id,'.gltf'))
                    END
            WHEN iiif_data IS NULL AND (images.state = 'validated' OR images.state = 'waiting_validation')
                THEN json_build_object('image_url',CONCAT('${config.apiUrl}/data/collections/', collection_id,'/images/thumbnails/',images.id,'.jpg'),
                                       'tiles', json_build_object('type', 'dzi', 'url', CONCAT('${config.apiUrl}/data/collections/', collection_id,'/images/tiles/',images.id,'.dzi')),
                                       'model_3d_url', CONCAT('${config.apiUrl}/data/collections/', collection_id,'/gltf/',images.id,'.gltf'))
            WHEN iiif_data IS NOT NULL
                THEN case 
                  WHEN iiif_data->>'size_info' IS NOT NULL
                    THEN json_build_object('image_url', NULL,
                                      'tiles', json_build_object('type', 'iiif', 'url', CONCAT(iiif_data->>'image_service3_url', '/info.json')))
                    WHEN iiif_data->>'regionByPx' IS NOT NULL
                    THEN json_build_object('image_url', CONCAT((iiif_data->>'image_service3_url'), '/', regexp_replace(iiif_data->>'regionByPx','[\\[\\]]', '', 'g'),'/200,/0/default.jpg'),
                                        'tiles', json_build_object('type', 'iiif', 'url', CONCAT(iiif_data->>'image_service3_url', '/info.json')),
                                        'regionByPx', iiif_data->'regionByPx')
                    ELSE json_build_object('image_url', CONCAT((iiif_data->>'image_service3_url'), '/full/200,/0/default.jpg'),
                                        'tiles', json_build_object('type', 'iiif', 'url', CONCAT(iiif_data->>'image_service3_url', '/info.json')))
                    END
            ELSE
                json_build_object('image_url',CONCAT('${config.apiUrl}/data/collections/', collection_id,'/images/thumbnails/',images.id,'.jpg'),
                                  'tiles', json_build_object('type', 'dzi', 'url', CONCAT('${config.apiUrl}/data/collections/', collection_id,'/images/tiles/',images.id,'.dzi')))
            end)`
          ),
          "media"
        ]
      ];

    const whereImages = {
      original_id: req.params.original_id
    };

    // Unpublished images can only be accessed by super administrators.
    if (!userHasRole(req, 'super_admin')) {
      whereImages.is_published = true;
    }

    const imagePromise = models.images.findOne({
      subQuery: false,
      attributes,
      include: [
        {
          model: models.apriori_locations,
          attributes: [
            [models.sequelize.literal("ST_X(geom)"), "longitude"],
            [models.sequelize.literal("ST_Y(geom)"), "latitude"],
          ],
          required:false
        },
        {
          model: models.observations,
          attributes: [],
          required: false,
          where: {
            state: "validated"
          }
        },
        {
          model: models.users,
          as: "georeferencer",
          attributes: ["id", "username"],
          required: false
        },
        {
          model: models.owners,
          attributes: ["id", [getFieldI18n('owner', 'name', lang), "name"], "link", "slug"],
          where: whereOwner
        },
        {
          model: models.collections,
          attributes: ["id", [getFieldI18n('collection', 'name', lang), "name"], "link"]
        },
        {
          model: models.photographers,
          as: "photographer",
          attributes: [
            "id", 
            [models.Sequelize.literal(`
              CASE
              WHEN photographer.first_name IS NOT NULL AND photographer.last_name IS NOT NULL AND company IS NOT NULL
                THEN photographer.first_name || ' ' || photographer.last_name || ', ' || company
              WHEN photographer.first_name IS NOT NULL AND photographer.last_name IS NOT NULL
                THEN photographer.first_name || ' ' || photographer.last_name
              WHEN photographer.last_name IS NOT NULL AND photographer.company IS NOT NULL
                THEN photographer.last_name || ', ' || photographer.company
              WHEN photographer.first_name IS NOT NULL
                THEN photographer.first_name
              WHEN photographer.last_name IS NOT NULL
                THEN photographer.last_name
              WHEN photographer.company IS NOT NULL
                THEN photographer.company
              ELSE 'unknown'
              END
              `),"name"], 
            "link"
          ],
          required: false
        },
        {
          model: models.geolocalisations, //used to build media.model_3d_url. If composite_image, the model_3d_url corresponds to the geolocalisation registered in the images table.
          attributes: ["id", "region_px"],
          required: false
        }
      ],
      group: ["images.id", "images.original_id", "observations.id", "apriori_locations.id", "georeferencer.id", "owner.id", "collection.id",
              "photographer.id", "photographer->images_photographers.image_id", "photographer->images_photographers.photographer_id",
              "geolocalisation.user_id", "geolocalisation.id", "geolocalisation.image_id"],
      where: whereImages
    });

    const imageViewsPromise = models.images_views.findAll({
      attributes: ["viewer_type", [models.sequelize.fn('COALESCE',models.sequelize.col('viewer_origin'), 'unknown'), 'viewer_origin'],[models.sequelize.fn('count', models.sequelize.col('viewer_type')),'count']],
      include: [
        {
          model: models.images,
          attributes: [],
          where: {
            original_id : req.params.original_id
          },
          include:[
            {
              model: models.owners,
              attributes: [],
              where: whereOwner
            }
          ]
        }
      ],
      group: ["viewer_type", "viewer_origin", "original_id"]
    });

    const [ image, imageViews ] = await Promise.all([ imagePromise, imageViewsPromise ]);

    if (image === null) {
      throw notFoundError(req);
    }

    image.dataValues.photographer.forEach((photographer) => {
      delete photographer.dataValues.images_photographers;
    });
    image.dataValues.photographers = image.dataValues.photographer;
    delete image.dataValues.photographer;

    const views = groupArray(imageViews, 'viewer_origin', 'viewer_type');

    //Group POSES attributes.
    //If composite_image, get all validated and waiting_validation poses from geolocalisations table.
    if (image.dataValues.framing_mode === 'composite_image') {
      const res_geolocs = await models.geolocalisations.findAll({
        attributes: [
          "id", "image_id", "state", "region_px", "azimuth", "tilt", "roll", "focal",
          [models.sequelize.literal("ST_X(geolocalisations.location)"), "longitude"],
          [models.sequelize.literal("ST_Y(geolocalisations.location)"), "latitude"],
          [models.sequelize.literal("ST_Z(geolocalisations.location)"), "altitude"]
        ],
        include: [
          {
            model: models.images,
            attributes: ["original_id"],
            where: {
              original_id: req.params.original_id
            },
            required: true
          }
        ],
        where: {
          state: {
            [Op.or]: ['validated','waiting_validation']
          }
        }
      });
    
      let poses = [];
      for (const geoloc of res_geolocs) {
        //gltf_url for the front-end
        let region_url = "";
        if (geoloc.dataValues.region_px) {
          region_url = `_${geoloc.dataValues.region_px[0]}_${geoloc.dataValues.region_px[1]}_${geoloc.dataValues.region_px[2]}_${geoloc.dataValues.region_px[3]}`;
        }
        const pose = {
          geolocalisation_id: geoloc.dataValues.id,
          image_id: geoloc.dataValues.image_id,
          state: geoloc.dataValues.state,
          regionByPx: geoloc.dataValues.region_px,
          gltf_url: `${config.apiUrl}/data/collections/${image.dataValues.collection.dataValues.id}/gltf/${geoloc.dataValues.image_id}${region_url}.gltf`,
          altitude: geoloc.dataValues.altitude,
          latitude: geoloc.dataValues.latitude,
          longitude: geoloc.dataValues.longitude,
          azimuth: parseFloat(geoloc.dataValues.azimuth),
          tilt: parseFloat(geoloc.dataValues.tilt),
          roll: parseFloat(geoloc.dataValues.roll),
          focal: parseFloat(geoloc.dataValues.focal)
          //country_iso_a2
          //heightAboveGround ??
          //locationLocked ??
        };
        poses.push(pose);
      }
      image.dataValues.poses = poses;
    }

    // Group POSE attributes. 
    //Geolocalisation registered in the images table.
    //If composite_image, corresponds to the last geolocalisation having been saved (geolocalisations/{id}/save).

    // Build gltf_url
    let gltf_url = null;
    let region_px = null;
    let geoloc_id = null;
    if (image.dataValues.geolocalisation) {
      region_px =  image.dataValues.geolocalisation.region_px;
      geoloc_id = image.dataValues.geolocalisation.id;
      let region_url = "";
      if (region_px) {
        region_url = `_${region_px[0]}_${region_px[1]}_${region_px[2]}_${region_px[3]}`;
      }
      gltf_url = `${config.apiUrl}/data/collections/${image.dataValues.collection.dataValues.id}/gltf/${image.dataValues.id}${region_url}.gltf`;
    }
    delete image.dataValues.geolocalisation;
    
    const { altitude, latitude, longitude, azimuth, tilt, roll, focal, country_iso_a2, ...partialObject } = image.toJSON();

    res.status(200).send({
      ...partialObject,
      views,
      pose: { altitude, latitude, longitude, azimuth, tilt, roll, focal, country_iso_a2, geolocalisation_id: geoloc_id, regionByPx: region_px, gltf_url }
    });
  });
