const models = require("../../models");
const logger = require('../../../config/logger');

//get all the stories
const getStories = async (req, res) => {
  try {
    const stories = await models.stories.findAll();
    res.json(stories);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Une erreur s\'est produite lors de la récupération des stories.' });
  }
};


//get a story by id
const getStoryById = async (req, res) => {
  const { id } = req.params;
  try {
    const story = await models.stories.findByPk(id);

    const basic_attributes = ["id", "picture_id", "title", "type", "url_media", "description", "zoom", "story", "indexinstory"];
    const longitude = [models.sequelize.literal("ST_X(images.location)"), "longitude"];
    const latitude = [models.sequelize.literal("ST_Y(location)"), "latitude"];
    const includeOption = [{
      model: models.images,
      attributes: [longitude, latitude],
    }];
    const sequelizeQuery = {
      attributes: basic_attributes,
      where: { story: id },
      orderBy: ["indexinstory"],
      include: includeOption
    };
    const chapters = await models.stories_chapters.findAll(sequelizeQuery);
    story.dataValues.chapters = chapters;
    if (story) {
      res.json(story);

    } else {
      res.status(404).json({ error: 'Aucun chapitre trouvé avec cet ID.' });
    }
  } catch (error) {
    logger.error(error);
    res.status(404).json({ error: `Une erreur s'est produite lors de la récupération de la story avec l'ID ${id}.` });
  }
};


/**
 * Method to add a Stories
 * @param {*} req 
 * @param {*} res 
 */
const addStory = async (req, res) => {
  const { title, logo_link, description, description_preview } = req.body;

  try {
    const newStory = await models.stories.create({ title, logo_link, description, description_preview });
    res.status(201).json(newStory);

  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: "Une erreur s'est produite lors de l'ajout de la story." });
  }
};

/**
 * Method to update a Stories
 * @param {*} req 
 * @param {*} res 
 */
const updateStory = async (req, res) => {
  const { title, logo_link, description, description_preview }= req.body;

  try {
    const updatedStory = await models.stories.update({ title, logo_link, description, description_preview }, {where: {id: req.params.id}});
    res.status(201).json(updatedStory);

  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: "Une erreur s'est produite lors de la mis à jour de la story." });
  }
};

const deleteStory = async (req, res) =>{
  try{
    const deletedStory = await models.stories.destroy({where: {id: req.params.id}});
    res.status(200).json(deletedStory);

  }catch(error){
    logger.error(error);
    res.status(500).json({error: "Une erreur c'est produite lors de la supression de la story"});
  }
}


module.exports = {
  getStories,
  getStoryById,
  addStory,
  updateStory,
  deleteStory
};
