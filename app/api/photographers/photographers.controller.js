const Sequelize = require("sequelize");

const models = require("../../models");
const utils = require("../../utils/express");
const { inUniqueOrList, cleanProp } = require("../../utils/params");

const Op = Sequelize.Op;

exports.getList = utils.route(async (req, res) => {

  //function which transforms string value(s) in where clauses into LIKE statements
  function addLikeToValue(request_values) {

    const request_value_like=[]
    if (typeof(request_values) ==='string') {
      request_value_like.push(`%${request_values}%`);
    } else if (request_values instanceof Array){
        for (const req_value of request_values) {
          request_value_like.push(`%${req_value}%`);
        }
    } else {
      return undefined
    }
    return  { [Op.iLike]: { [Op.any]: request_value_like } }  // LIKE ANY ARRAY['cat', 'hat']

  }
  //where photographers
  const wherePhotographers = {
    id: inUniqueOrList(req.query.id),
    first_name: addLikeToValue(req.query.first_name),
    last_name: addLikeToValue(req.query.last_name),
    company: addLikeToValue(req.query.company)
  }
  const cleanedWherePhotographers = cleanProp(wherePhotographers);
 
  //REQUEST
  const results = await models.photographers.findAll({
    attributes: {
      include: [
        [models.sequelize.fn("COUNT", models.sequelize.col("images.id")), "nImages"]
      ]
    },
    include: [
      {
        model: models.images, 
        as: "images",
        attributes: [],
        required: false, //left join (so photographers with no images are also returned)
      }
    ],
    includeIgnoreAttributes: false,
    where: cleanedWherePhotographers,
    group: ["photographers.id"],
    
    order: [["id", "DESC"]]
  });

  res.status(200).send(results);
});



// POST /photographers
// ==================

exports.postPhotographers = utils.route(async (req, res) => {

  const photographer = await models.photographers.create({
    first_name: req.body.first_name,
    last_name: req.body.last_name,
    link: req.body.link,
    company: req.body.company
  });
  res.status(201).send(photographer);
});