const models = require("../models");
const { userHasRole } = require("./authorization");
const { authorizationError } = require("./errors");


exports.validateStoryRight = async (req, res, id) => {
  if (!userHasRole(req, 'owner_validator', 'owner_admin', 'super_admin')) {
    throw authorizationError('Unpublished collections can only be accessed by respective owner or super administrators');
  }

  if (req.user.owner_id !== null) {
    const storyToValidate = await models.stories.findByPk(id);
    if (storyToValidate.owner_id != req.user.owner_id) {
      throw authorizationError('Unpublished collections can only be accessed by respective owner or super administrators');
    }
  }
} 
