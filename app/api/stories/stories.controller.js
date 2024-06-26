const models = require("../../models");
const { getFieldI18n } = require("../../utils/params");
const { inUniqueOrList, cleanProp } = require("../../utils/params");
const { validateStoryRight } = require('../../utils/story');
const { route } = require("../../utils/express");

//get all the stories
const getStories = route(async (req, res) => {
  const lang = req.getLocale();
  const owner_id = inUniqueOrList(req.query.owner_id);
  const whereClause = owner_id ? {} : {};
  const includeOption = [{
    model: models.owners,
    attributes: [
      'id',
      [getFieldI18n('owner', 'name', lang), 'name'],
    ],
  },
  {
    model: models.stories_chapters,
    attributes: []
  }];
  const stories = await models.stories.findAll({
    attributes: [
      'id',
      "title",
      "logo_link",
      "description",
      "description_preview",
      "owner_id",
      [models.sequelize.fn("COUNT", models.sequelize.col("stories_chapters.id")), "nbChapters"] 
    ],
    where: cleanProp(whereClause),
    include: includeOption,
    group: ['stories.id', 'owner.id'],
    order: [['id', 'DESC']],
  });
  res.json(stories);
});


//get a story by id
const getStoryById = route(async (req, res) => {
  const { id } = req.params;
  const story = await models.stories.findByPk(id);

  const basic_attributes = ["id", "picture_id", "title", "type", "url_media", "description", "zoom", "story_id", "indexinstory", "view_custom"];
  const longitude = [models.sequelize.literal("ST_X(image.location)"), "longitude"];
  const latitude = [models.sequelize.literal("ST_Y(image.location)"), "latitude"];
  const includeOption = [{
    model: models.images,
    attributes: [longitude, latitude],
  }];
  const sequelizeQuery = {
    attributes: basic_attributes,
    where: { story_id: id },
    order: [['indexinstory', 'ASC']],
    include: includeOption
  };

  const chapters = await models.stories_chapters.findAll(sequelizeQuery);
  story.dataValues.chapters = chapters;
  if (story) {
    res.json(story);
  } else {
    res.status(404).json({ error: 'Aucun chapitre trouvé avec cet ID.' });
  }
  
});


/**
 * Method to add a Stories
 * @param {*} req 
 * @param {*} res 
 */
const addStory = route(async (req, res) => {
  const { title, logo_link, description, description_preview, owner_id } = req.body;

  const newStory = await models.stories.create({ title, logo_link, description, description_preview, owner_id });
  res.status(201).json(newStory);
});

/**
 * Method to update a Stories
 * @param {*} req 
 * @param {*} res 
 */
const updateStory = route(async (req, res) => {
  const { title, logo_link, description, description_preview, owner_id }= req.body;

  await validateStoryRight(req, res, req.params.id);

  
  const updatedStory = await models.stories.update({ title, logo_link, description, description_preview, owner_id }, {where: {id: req.params.id}, returning: true, plain: true});
  // The return of an update is an array of two elements. First: the number of affected row. Second: the modified row.
  res.status(200).json(updatedStory[1]);
});

const deleteStory = route(async (req, res) =>{

  await validateStoryRight(req, res, req.params.id);

  await models.stories.destroy({where: {id: req.params.id}});
  res.send({
    message: "The story was deleted."
  });
})

module.exports = {
  getStories,
  getStoryById,
  addStory,
  updateStory,
  deleteStory
};
