const { Stories, Stories_chapters } = require("../../models");

//get all the stories
const getStories = async (req, res) => {
  try {
    const stories = await Stories.findAll();
    res.json(stories);
  } catch (error) {
    res.status(500).json({ error: 'Une erreur s\'est produite lors de la récupération des stories.' });
  }
};


//get a story by id
const getStoryById = async (req, res) => {
  const { id } = req.params;
  try {
    const story = await Stories.findByPk(id);
    const chaptersOfStory = await Stories_chapters.sequelize.query(`
    SELECT stories_chapters.title, stories_chapters.type, picture_id,
    stories_chapters.url_media, stories_chapters.description, stories_chapters.zoom, stories_chapters.story, 
    ST_X(images.location) as longitude, ST_Y(images.location) as latitude
    FROM stories_chapters, images 
    WHERE stories_chapters.picture_id = images.id
    AND stories_chapters.story = :storyId
    ORDER BY stories_chapters.indexinstory`,
    {    
      replacements: { storyId: id },
      type: Stories_chapters.sequelize.QueryTypes.SELECT},
    )
    story.dataValues.chapters = chaptersOfStory;



    if (story) {
      res.json(story);

    } else {
      res.status(404).json({ error: 'Aucun chapitre trouvé avec cet ID.' });
    }
  } catch (error) {
    res.status(404).json({ error: `Une erreur s'est produite lors de la récupération de la story avec l'ID ${id}.` });
  }
};


/**
 * Method to add a Stories
 * @param {*} req 
 * @param {*} res 
 */
const addStory = async (req, res) => {
  let { title, logo_link } = req.body;

  try {
    const newStory = await Stories.create({ title, logo_link });
    res.status(201).json(newStory);

  } catch (error) {
    res.status(500).json({ error: "Une erreur s'est produite lors de l'ajout de la story." });
  }
};

/**
 * Method to update a Stories
 * @param {*} req 
 * @param {*} res 
 */
const updateStory = async (req, res) => {
  let { title, logo_link } = req.body;

  try {
    const updatedStory = await Stories.update({ title, logo_link }, {where: {id: req.params.id}});
    res.status(201).json(updatedStory);

  } catch (error) {
    res.status(500).json({ error: "Une erreur s'est produite lors de la mis à jour de la story." });
  }
};

const deleteStory = async (req, res) =>{
  try{
    const deletedStory = await Stories.destroy({where: {id: req.params.id}});
    res.status(200).json(deletedStory);

  }catch(error){
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
