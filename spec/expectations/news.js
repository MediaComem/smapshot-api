/**
 * Returns the expected news JSON from the API for a given database row.
 *
 * @param {Object} news - The news database row.
 * @param {Object} [options] - Additional options. Any undocumented option is
 * considered an additional property to be added to the expected object.
 * @param {string} [options.locale] - The locale to use for the expected object.
 * @returns {Object} The expected API news.
 */
exports.getExpectedNews = (
  news,
  options = {}
) => {

  const locale = options.locale || 'en';

  const expected = {
    id: news.id,
    title: news.title[locale],
    description: news.description[locale],
    description_preview: news.description_preview[locale],
    img_url: news.img_url,
    img_alt: news.img_alt[locale],
    created_at: news.created_at.toISOString(),
  };
  
  return expected;
};

