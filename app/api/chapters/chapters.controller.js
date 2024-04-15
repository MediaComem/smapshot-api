const models = require("../../models");


//get all the chapters
const getChapters = async (req, res) => {
  try {
    const basic_attributes = ["picture_id", "title", "type", "url_media", "description", "zoom", "story"];
    const longitude = [models.sequelize.literal("ST_X(images.location)"), "longitude"];
    const latitude = [models.sequelize.literal("ST_Y(location)"), "latitude"];
    const includeOption = [{
      model: models.images,
      attributes: [longitude, latitude],
    }];
    const sequelizeQuery = {
      attributes: basic_attributes,
      orderBy: ["indexinstory"],
      include: includeOption
    };
    const chapters = await models.stories_chapters.findAll(sequelizeQuery);
    res.json(chapters);
  } catch (error) {
    res.status(500).json({ error: 'Une erreur s\'est produite lors de la récupération des chapitres.' });
  }
};


//get a chapter by id
const getChapterById = async (req, res) => {
  const { id } = req.params;
  try {
    const chapter = await models.stories_chapters.findByPk(id);
    if (chapter) {
      res.json(JSON.stringify({ "chapters": chapter }));
    } else {
      res.status(404).json({ error: 'Aucun chapitre trouvé avec cet ID.' });
    }
  } catch (error) {
    res.status(500).json({ error: `Une erreur s'est produite lors de la récupération du chapitre avec l'ID ${id}.` });
  }
};


//Add a chapter to the db
const addChapter = async (req, res) => {
  const { title, type, picture_id, url_media, description, zoom, story, indexinstory } = req.body;
  try {
    const newChapter = await models.stories_chapters.create({
      title,
      type,
      picture_id,
      url_media,
      description,
      zoom,
      story,
      indexinstory
    });
    res.status(201).json(newChapter); // Return the ID of the newly created chapter
  } catch (error) {
    res.status(500).json({ error: 'Une erreur s\'est produite lors de l\'ajout du chapitre.' });
  }
};


//Update a chapter
const updateChapter = async (req, res) => {
  const { title, type, picture_id, url_media, description, zoom, story, indexinstory  } = req.body;
  try {
    const updatedChapter = await models.stories_chapters.update({
      title,
      type,
      picture_id,
      url_media,
      description,
      zoom,
      story,
      indexinstory
    },{

      where: {id: req.params.id},
    });
    res.status(201).json(updatedChapter); // Return the ID of the newly created chapter
  } catch (error) {
    res.status(500).json({ error: 'Une erreur s\'est produite lors de la misz à jour du chapitre.' });
  }
};

const deleteChapter = async (req, res) =>{

  try{
    const deletedChapter = await models.stories_chapters.destroy({where: {id:req.params.id}});
    res.status(200).json(deletedChapter);
    
  }catch(error){
    res.status(500).json({error: "Une erreur c'est produite lors de la supression du chapitre"});
  }
}

module.exports = {
  getChapters,
  getChapterById,
  addChapter,
  updateChapter,
  deleteChapter
};
