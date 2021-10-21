const Sequelize = require("sequelize");

const models = require("../../models");
const { route } = require("../../utils/express");
const { inUniqueOrList, cleanProp, iLikeFormatter, getFieldI18n } = require("../../utils/params");

const Op = Sequelize.Op;

// GET /problems
// =============

exports.getList = route(async (req, res) => {
  const lang = req.getLocale();
  const whereProblems = {
    id: inUniqueOrList(req.query.id),
    state: inUniqueOrList(req.query.state),
    date_created: {
      [Op.gte]: req.query.date_created_min,
      [Op.lte]: req.query.date_created_max
    }
  };

  const cleanedWhereProblems = cleanProp(whereProblems);

  const whereTypes = { source: inUniqueOrList(req.query.source) };
  const cleanedWhereTypes = cleanProp(whereTypes);

  const whereImages = {
    id: inUniqueOrList(req.query.image_id),
    original_id: inUniqueOrList(req.query.original_id)
  };
  const cleanedWhereImages = cleanProp(whereImages);

  const whereOwners = { id: inUniqueOrList(req.query.owner_id) };
  const cleanedWhereOwners = cleanProp(whereOwners);

  const whereCollections = { id: inUniqueOrList(req.query.collection_id) };
  const cleanedWhereCollections = cleanProp(whereCollections);

  const whereVolunteers = {
    id: inUniqueOrList(req.query.volunteer_id),
    username: inUniqueOrList(iLikeFormatter(req.query.username_volunteer))
  };
  const cleanedWhereVolunteers = cleanProp(whereVolunteers);

  const problems = await models.problems.findAll({
    attributes: ["id", "date_created", "title", "description", "problem_type_id", "state"],
    where: cleanedWhereProblems,
    order: [["id"]],
    include: [
      {
        model: models.problems_type,
        attributes: ["id", "title", [getFieldI18n('problems_type', 'translations', lang), "translation"]],
        where: cleanedWhereTypes
      },
      {
        model: models.images,
        attributes: ["id", "original_id", "is_published"],
        where: cleanedWhereImages,
        include: [
          {
            model: models.owners,
            attributes: [[getFieldI18n('image->owner', 'name', lang), "name"]],
            where: cleanedWhereOwners
          },
          {
            model: models.collections,
            attributes: [[getFieldI18n('image->collection', 'name', lang), "name"]],
            where: cleanedWhereCollections
          }
        ]
      },
      {
        model: models.users,
        as: "volunteer",
        attributes: ["username"],
        where: cleanedWhereVolunteers
      },
      {
        model: models.users,
        as: "validator",
        attributes: ["username"],
        required: false
      }
    ]
  });

  res.status(200).send(problems);
});

// GET /problems/types
// ===================

exports.getTypes = route(async (req, res) => {
  const lang = req.getLocale();

  const queryOptions = {
    attributes: ["id", "title", [getFieldI18n('problems_type', 'translations', lang), "translation"]],
    order: [["id", "ASC"]],
    where: {
      source: 'image'
    }
  };

  if (req.query.id) {
    queryOptions.where.id = inUniqueOrList(req.query.id);
  }

  if (req.query.source) {
    queryOptions.where.source = inUniqueOrList(req.query.source);
  }

  const types = await models.problems_type.findAll(queryOptions);

  res.status(200).send(types);
});
