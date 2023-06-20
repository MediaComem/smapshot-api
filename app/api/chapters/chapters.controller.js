const { Stories_chapters } = require('../../models');


//get all the chapters
const getChapters = async (req, res) => {
  try {
    const chapters = await Stories_chapters.sequelize.query(`
    SELECT stories_chapters.title, stories_chapters.type, picture_id,
    stories_chapters.url_media, stories_chapters.description, stories_chapters.zoom, stories_chapters.story, 
    ST_X(images.location) as longitude, ST_Y(images.location) as latitude
    FROM stories_chapters, images 
    WHERE stories_chapters.picture_id = images.id`,
    {type: Stories_chapters.sequelize.QueryTypes.SELECT},
    )
    res.json(chapters);
  } catch (error) {
    res.status(500).json({ error: 'Une erreur s\'est produite lors de la récupération des chapitres.' });
  }
};


//get a chapter by id
const getChapterById = async (req, res) => {
  const { id } = req.params;
  try {
    const chapter = await Stories_chapters.findByPk(id);
    if (chapter) {
      res.json(chapter);
    } else {
      res.status(404).json({ error: 'Aucun chapitre trouvé avec cet ID.' });
    }
  } catch (error) {
    res.status(500).json({ error: `Une erreur s'est produite lors de la récupération du chapitre avec l'ID ${id}.` });
  }
};


//Add a chapter to the db
const addChapter = async (req, res) => {
  const { title, type, picture_id, url_media, description, zoom, story, indexInStory } = req.body;
  try {
    const newChapter = await Stories_chapters.create({
      title,
      type,
      picture_id,
      url_media,
      description,
      zoom,
      story,
      indexInStory
    });
    res.status(201).json(newChapter); // Return the ID of the newly created chapter
  } catch (error) {
    res.status(500).json({ error: 'Une erreur s\'est produite lors de l\'ajout du chapitre.' });
  }
};


//Update a chapter
const updateChapter = async (req, res) => {
  const { title, type, picture_id, url_media, description, zoom, story, indexInStory  } = req.body;
  try {
    const updatedChapter = await Stories_chapters.update({
      title,
      type,
      picture_id,
      url_media,
      description,
      zoom,
      story,
      indexInStory
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
    const deletedChapter = await Stories_chapters.destroy({where: {id:req.params.id}});
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
