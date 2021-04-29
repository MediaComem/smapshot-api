const { version } = require('../../package.json');

exports.getRoot = (req, res) => {
  res.send({
    version
  });
};
