const { get } = require('lodash');

const { chance } = require('../utils/chance');

const locales = [ 'de', 'en', 'fr', 'it', 'pt' ];

/**
 * The locales supported by the application.
 */
exports.locales = locales;

/**
 * Generates a localized description object.
 *
 * @returns {LocalizedString} A localized object.
 */
exports.generateRandomLocalizedDescription = () => {
  return generateRandomLocalized(() => chance.paragraph());
};

/**
 * Generates a localized name object. By default, each name is composed of three
 * random words.
 *
 * @param {Object} [options] - Options.
 * @param {number} [options.words] - The number of words in each name.
 * @returns {LocalizedString} A localized object.
 */
exports.generateRandomLocalizedName = (options = {}) => {
  const words = get(options, 'words', 3);
  return generateRandomLocalized(() => chance.sentence({ words }).replace(/\.$/, ''));
};

function generateRandomLocalized(generator) {
  return locales.reduce(
    (memo, locale) => ({ ...memo, [locale]: generator() }),
    {}
  );
}

/**
 * @typedef {Map.<string, string>} LocalizedString
 */
