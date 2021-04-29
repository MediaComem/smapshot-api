const { __ } = require('i18n');

/**
 * Translates the specified key. An error is thrown if there is no translation
 * for that key.
 *
 * @param {string} translationKey - The key of the translation.
 * @returns {string} The translation.
 * @throws If the translation cannot be found.
 */
exports.ensureTranslation = translationKey => {

  const translation = __(translationKey);
  if (translation === translationKey) {
    throw new Error(`Could not find translation ${translationKey}`);
  }

  return translation;
};
