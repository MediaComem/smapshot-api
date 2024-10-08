const Sequelize = require("sequelize");
const config = require("../../../config");
const models = require("../../models");
const utils = require("../../utils/express");
const mediaUtils = require("../../utils/media");

const Op = Sequelize.Op;

exports.getList = utils.route(async (req, res) => {
  const lang = req.query.lang || (req.getLocale() || config.langFallback);

  const offset = req.query.offset ? parseInt(req.query.offset) : 0;
  const limit = req.query.limit ? parseInt(req.query.limit) : 10;

  const news = await models.news.findAndCountAll({
    limit,
    offset,
    order: [["published_at", "DESC"]],
    where: {
      published_at: {
        [Op.lte]: new Date(),
      },
    },
  });

  const newsPaginated = {
    data: {
      news: news.rows.map((news) => {
        return {
          id: news.id,
          title: news.title[lang] ?? news.title[config.langFallback],
          description:
            news.description[lang] ?? news.description[config.langFallback],
          description_preview:
            news.description_preview[lang] ??
            news.description_preview[config.langFallback],
          img_url: news.img_url,
          img_alt: news.img_alt
            ? news.img_alt[lang] ?? news.img_alt[config.langFallback]
            : null,
          published_at: news.published_at,
        };
      }),
    },
    pagination: {
      total_records: news.count,
      current_page: Math.floor(offset === 0 ? 1 : offset / limit + 1),
      page_size: limit,
      total_pages: Math.ceil(news.count / limit),
      links: {
        prev_page:
          offset >= limit
            ? config.apiUrl +
              "/news?offset=" +
              (offset - limit) +
              "&limit=" +
              limit
            : null,
        next_page:
          offset < news.count - limit
            ? config.apiUrl +
              "/news?offset=" +
              (offset + limit) +
              "&limit=" +
              limit
            : null,
      },
    },
  };

  return res.send(newsPaginated);
});
