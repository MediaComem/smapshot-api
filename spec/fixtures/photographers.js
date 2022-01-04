const { QueryTypes } = require('sequelize');

const { sequelize } = require('../../app/models');
const { chance } = require('../utils/chance');
const { getOrGenerate, serialize } = require('../utils/fixtures');

/**
 * Inserts a photographer into the database. Column values that are not
 * provided will be randomly generated or set to a default value.
 *
 * The anonym photographer can be generated manually by specifying lastname `Anonyme`, 
 * or automatically when an image with no photographer is created. Only generated once.
 * @param {Object} [options] - Database column values for the photographer.
 * @returns {Object} The inserted row, including its generated ID.
 */
exports.createPhotographer = async (options = {}) => {

  function insertInDB(columns) {
    result = sequelize.query(
      `
        INSERT INTO photographers
        (
          first_name, last_name, link, company
        )
        VALUES (
          :first_name, :last_name, :link, :company
        )
        RETURNING id
      `,
      {
        replacements: serialize(columns),
        type: QueryTypes.INSERT
      }
    );
    return result;
  }

  let result, columns;
  //photographer anonym generated. check that not already exists in DB
  if (options.last_name === 'Anonyme') {
    const photographerAnonym = await sequelize.query(
      `
      SELECT id, first_name, last_name, link, company
      FROM public.photographers
      WHERE last_name LIKE 'Anonyme';
      `
    );

    if (photographerAnonym[0].length > 0) {
      //photographer anonym already exists: do not create
      result = photographerAnonym;
      columns = {photographerAnonym};

    } else {
      //create photographer anonym
      columns = {
        first_name: getOrGenerate(options, 'first_name', () => chance.first()),
        last_name: getOrGenerate(options, 'last_name', () => chance.last()),
        link: getOrGenerate(options, 'link', () => chance.url({ domain: 'localhost.localdomain' })),
        company: getOrGenerate(options, 'company', () => chance.word())
      };
      result = await insertInDB(columns);
    }
  //any other photographers generated
  } else {
    columns = {
      first_name: getOrGenerate(options, 'first_name', () => chance.first()),
      last_name: getOrGenerate(options, 'last_name', () => chance.last()),
      link: getOrGenerate(options, 'link', () => chance.url({ domain: 'localhost.localdomain' })),
      company: getOrGenerate(options, 'company', () => chance.word())
    };
    result = await insertInDB(columns);
  }

  const rows = result[0];
  const insertedPhotographer = rows[0];

  return {
    ...columns,
    id: insertedPhotographer.id
  };
};
