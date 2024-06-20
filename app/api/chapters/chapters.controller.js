const models = require("../../models");
const { notFoundError } = require('../../utils/errors');

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
  const { title, type, picture_id, url_media, description, zoom, indexinstory, view_custom } = req.body;
  const newChapter = await models.stories_chapters.create({
      title,
      type,
      picture_id,
      url_media,
      description,
      zoom,
      story_id: storyId,
      indexinstory,
      view_custom
  });
  res.status(201).json(newChapter); // Return the ID of the newly created chapter
};


//Update a chapter
const updateChapter = async (req, res) => {
  const { storyId, id } = req.params;
  const { title, type, picture_id, url_media, description, zoom, indexinstory, view_custom } = req.body;
  const updatedChapter = await models.stories_chapters.update({
    title,
    type,
    picture_id,
    url_media,
    description,
    zoom,
    story_id: storyId,
    indexinstory,
    view_custom
  },
  {
    where: {id: id}, returning: true, plain: true
  });
  res.status(200).json(updatedChapter[1]); // Return the ID of the newly created chapter
};

const deleteChapter = async (req, res) => {

  await models.stories_chapters.destroy({where: {id:req.params.id}});
  res.send({
    message: "The story was deleted."
  });
  
}

module.exports = {
  getChapterById,
  addChapter,
  updateChapter,
  deleteChapter
};
