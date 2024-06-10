const models = require("../../models");

//get all the stories
const getStories = async (req, res) => {
  const stories = await models.stories.findAll();
  res.json(stories);
};


//get a story by id
const getStoryById = async (req, res) => {
  const { id } = req.params;
  const story = await models.stories.findByPk(id);

  const basic_attributes = ["id", "picture_id", "title", "type", "url_media", "description", "zoom", "story", "indexinstory", "view_custom"];
  const longitude = [models.sequelize.literal("ST_X(images.location)"), "longitude"];
  const latitude = [models.sequelize.literal("ST_Y(images.location)"), "latitude"];
  const includeOption = [{
    model: models.images,
    attributes: [longitude, latitude],
  }];
  const sequelizeQuery = {
    attributes: basic_attributes,
    where: { story: id },
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
};


/**
 * Method to add a Stories
 * @param {*} req 
 * @param {*} res 
 */
const addStory = async (req, res) => {
  const { title, logo_link, description, description_preview } = req.body;

  const newStory = await models.stories.create({ title, logo_link, description, description_preview });
  res.status(201).json(newStory);
};

/**
 * Method to update a Stories
 * @param {*} req 
 * @param {*} res 
 */
const updateStory = async (req, res) => {
  const { title, logo_link, description, description_preview }= req.body;

  const updatedStory = await models.stories.update({ title, logo_link, description, description_preview }, {where: {id: req.params.id}, returning: true, plain: true});
  // The return of an update is an array of two elements. First: the number of affected row. Second: the modified row.
  res.status(200).json(updatedStory[1]);
};

const deleteStory = async (req, res) =>{
  await models.stories.destroy({where: {id: req.params.id}});
  res.send({
    message: "The story was deleted."
  });
}


module.exports = {
  getStories,
  getStoryById,
  addStory,
  updateStory,
  deleteStory
};
