const { isArray, last, uniq } = require('lodash');
const Sequelize = require("sequelize");

const models = require("../models");
const utils = require("../utils/express");

const Op = Sequelize.Op;

exports.getWhereOwnerIdOrSlug = id_slug => {
  const id_slug_integer = parseInt(id_slug, 10);
  return Number.isInteger(id_slug_integer)
    ? { id: id_slug_integer }
    : { slug: id_slug };
}

exports.anyUniqueOrList = ids => {
  if (ids) {
    if (Array.isArray(ids)) {
      return {
        [Op.any]: ids
      };
    } else {
      return ids;
    }
  }
};

exports.inUniqueOrList = ids => {
  if (ids) {
    if (Array.isArray(ids)) {
      return {
        [Op.in]: ids
      };
    } else {
      return ids;
    }
  }
};

exports.overlapUniqueOrList = ids => {
  if (ids) {
    if (Array.isArray(ids)) {
      return {
        [Op.overlap]: ids
      };
    } else {
      return {
        [Op.overlap]: [ids]
      };
    }
  }
};

exports.containsUniqueOrList = ids => {
  if (ids) {
    if (Array.isArray(ids)) {
      return {
        [Op.contains]: ids
      };
    } else {
      return {
        [Op.contains]: [ids]
      };
    }
  }
};

exports.bboxFormater = bbox => {
  if (bbox && bbox.length === 4) {
    return {
      [Op.overlap]: models.sequelize.fn(
        "ST_MakeEnvelope",
        bbox[0],
        bbox[1],
        bbox[2],
        bbox[3]
      )
    };
  } else if (bbox && bbox.length < 4) {
    throw utils.createApiError("Missing value in bbox optional parameter", {
      status: 400
    });
  } else {
    return undefined;
  }
};

exports.wktFormatter = (wktRoi, intersectLocation, intersectFootprint) => {
  if (!wktRoi || (!intersectLocation && intersectFootprint)) {
    return undefined;
  }

  if (intersectLocation && intersectFootprint == null) {
    return models.sequelize.literal(
      `st_intersects(images.location,st_geomfromtext('${wktRoi}'))`
    );
  }
  if (intersectLocation == null && intersectFootprint) {
    return `
      (st_intersects(images.footprint, st_geomfromtext('${wktRoi}'))
      AND viewshed_created = TRUE)`;
  }
  if (intersectLocation && intersectFootprint) {
    return `
      (st_intersects(images.footprint,st_geomfromtext('${wktRoi}'))
      OR st_intersects(images.footprint,st_geomfromtext('${wktRoi}'))
      AND images.viewshed_created = TRUE)`;
  }
};

exports.iLikeFormatter = val => {
  if (!val) {
    return undefined;
  }

  return {
    [Op.iLike]: `%${exports.anyUniqueOrList(val)}%`
  };
};

const isObject = value => {
  return value && typeof value === "object" && value.constructor === Object;
};

const removeUndefProp = obj => {
  Reflect.ownKeys(obj).forEach(key => {
    // Reflect.ownKeys target symbols as well
    if (obj[key] && isObject(obj[key])) removeUndefProp(obj[key]);
    if (obj[key] && Array.isArray(obj[key]))
      obj[key] = obj[key].filter(el => el != null);
    else if (obj[key] === undefined) delete obj[key];
  });
  return obj;
};

const removeEmptyProp = obj => {
  Reflect.ownKeys(obj).forEach(key => {
    if (obj[key] && isObject(obj[key])) removeEmptyProp(obj[key]);
    //recursive for objects
    if (isObject(obj[key]) && Reflect.ownKeys(obj[key]).length == 0)
      delete obj[key]; //remove empty objects
  });
  return obj;
};

exports.cleanProp = obj => {
  return removeEmptyProp(removeUndefProp(obj));
};

exports.toArray = value => {
  if (value === undefined) {
    return [];
  } else if (Array.isArray(value)) {
    return value;
  } else {
    return [ value ];
  }
};

exports.toUniqueArray = value => uniq(exports.toArray(value));

exports.toWhereSubquery = (attributes, tableName) => {
  const whereCleaned = exports.cleanProp(attributes);
  const whereStringified = models.sequelize.getQueryInterface().QueryGenerator.getWhereConditions(whereCleaned, tableName);
  return whereStringified !== '' ? 'AND' + whereStringified : '';
};

exports.toWhereSubquery = (attributes, tableName) => {
  const whereCleaned = exports.cleanProp(attributes);
  const whereStringified = models.sequelize.getQueryInterface().QueryGenerator.getWhereConditions(whereCleaned, tableName);
  return whereStringified !== '' ? 'AND' + whereStringified : '';
};

exports.subQuery = (table, attributes, where) => {
  const query = models.sequelize.getQueryInterface().QueryGenerator.selectQuery(table, {
    attributes: [attributes],
    where
  }).slice(0, -1);

  return models.sequelize.literal('(' + query + ')')
};

exports.getFieldI18n = (table, field, lang) => {
  // Seems a bit literal (haha) but it doesn't seem to be easy to have a fn for all case include, subInclude, etc…
  return models.sequelize.literal(`COALESCE("${table}"."${field}"->>'${lang}', "${table}"."${field}"->>'en')`)
};

/**
 * Parses an URL query parameter as a single boolean value. The exact value
 * "true" is parsed as true. Anything else is parsed as false.
 *
 * @param {*} value - The value of the parameter.
 * @param {(boolean|undefined)} defaultValue - The default value to return if
 * the parameter is not specified.
 * @returns {(boolean|undefined)} True if the parameter is "true" or if the
 * parameter is not specified and the default value is true. False if the
 * parameter is anything other than "true" or if the parameter is not specified
 * and the default value is false. Undefined if neither the parameter nor the
 * default value are specified.
 */
exports.parseBooleanQueryParam = (value, defaultValue) => value !== undefined ? parseSingleQueryParam(value).toLowerCase() === 'true' : defaultValue;

/**
 * Parses and returns a single-valued URL query parameter as a string. If the
 * parameter is provided multiple times, the last value is returned. If the
 * parameter is undefined, the function returns undefined.
 *
 * @param {*} value - The value of the parameter as returned by Express.
 * @returns {(string|undefined)} The single value of the parameter, if
 * specified.
 */
function parseSingleQueryParam(value) {
  if (value === undefined) {
    return;
  } else if (isArray(value)) {
    return String(last(value));
  } else {
    return String(value);
  }
}
