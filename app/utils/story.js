const models = require("../models");
const { userHasRole } = require("./authorization");
const { authorizationError } = require("./errors");


exports.validateStoryRight = async (req, res, id) => {
  if (userHasRole(req, 'super_admin')) {
    return;
  }

  if (!userHasRole(req, 'owner_validator', 'owner_admin')) {
    throw authorizationError('You have not enough right for this action');
  }

  if (req.user.owner_id !== null && id !== null) {
    const storyToValidate = await models.stories.findByPk(id);
    if (storyToValidate.owner_id != req.user.owner_id) {
      throw authorizationError('You are not the owner of this story');
    }
  }
} 
