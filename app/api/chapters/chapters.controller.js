const models = require("../../models");
const logger = require('../../../config/logger');
const { notFoundError } = require('../../utils/errors');

//get a chapter by id
const getChapterById = async (req, res) => {
  const { id } = req.params;
  const chapter = await models.stories_chapters.findByPk(id);
  if (chapter) {
    res.json(chapter);
  } else {
    throw notFoundError(req);
  }
};


//Add a chapter to the db
const addChapter = async (req, res) => {
  const { storyId } = req.params;
  const { title, type, picture_id, url_media, description, zoom, indexinstory } = req.body;
  try {
    const newChapter = await models.stories_chapters.create({
      title,
      type,
      picture_id,
      url_media,
      description,
      zoom,
      story: storyId,
      indexinstory
    });
    res.status(201).json(newChapter); // Return the ID of the newly created chapter
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Une erreur s\'est produite lors de l\'ajout du chapitre.' });
  }
};


//Update a chapter
const updateChapter = async (req, res) => {
  const { storyId, id } = req.params;
  const { title, type, picture_id, url_media, description, zoom, indexinstory  } = req.body;
  try {
    const updatedChapter = await models.stories_chapters.update({
      title,
      type,
      picture_id,
      url_media,
      description,
      zoom,
      story: storyId,
      indexinstory
    },{

      where: {id: id},
    });
    res.status(201).json(updatedChapter); // Return the ID of the newly created chapter
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Une erreur s\'est produite lors de la misz à jour du chapitre.' });
  }
};

const deleteChapter = async (req, res) =>{

  try{
    const deletedChapter = await models.stories_chapters.destroy({where: {id:req.params.id}});
    res.status(200).json(deletedChapter);
    
  }catch(error){
    logger.error(error);
    res.status(500).json({error: "Une erreur c'est produite lors de la supression du chapitre"});
  }
}

module.exports = {
  getChapterById,
  addChapter,
  updateChapter,
  deleteChapter
};
