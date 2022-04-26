const { QueryTypes } = require('sequelize');
const { pick } = require('lodash');

const { sequelize } = require('../../app/models');
const { chance } = require('../utils/chance');
const { get, getOrGenerate, getOrGenerateAssociation } = require('../utils/fixtures');
const { createCollection } = require('./collections');
const { createPhotographer } = require('./photographers');
const { createImagesPhotographers } = require('./images_photographers');
const { createAPrioriLocation } = require('./apriori_locations')
/**
 * Inserts an image into the database. Column values that are not provided will
 * be randomly generated or set to a default value.
 *
 * The following associated resources may be automatically generated as well:
 *
 * * The collection containing the image (unless provided with `collection_id`
 *   or `collection`).
 * * The owner of the image (unless provided with `owner_id` or `owner`). It
 *   defaults to the owner of the generated collection.
 * * The photographer of the image (anonym, unless `photographers` provided).
 *
 * If no collection or owner are provided, they are randomly generated. The
 * owner of the image will be the same as the owner of the collection.
 *
 * @param {Object} [options] - Database column values for the image.
 * @returns {Object} The inserted row, including its generated ID. Additionally,
 * the `collection` and `owner` properties may include the associated fixtures
 * which were automatically generated.
 */
exports.createImage = async (options = {}) => {
  const view_types = [ null, 'terrestrial', 'lowOblique', 'highOblique', 'nadir' ];
  const framing_modes = ['single_image', 'composite_image'];

  let { owner, user, longitude, latitude, altitude, apriori_longitude, apriori_latitude, apriori_azimuth, apriori_exact, photographers } = options;
  // ensure owner is consistent if given
  options.collection = { ...pick(options, "owner", "owner_id"), ...options.collection };
  const { collection, collection_id } = await getOrGenerateAssociation(options, createCollection, 'collection');
  if (!owner) {
    // retrieve the owner created when generating the collection
    owner = collection.owner;
  }
  //retrieve iiif_data if given
  let iiif_data = null;
  if (options.iiif_data) {
    iiif_data = options.iiif_data.regionByPx ? `json_build_object('image_service3_url','${options.iiif_data.image_service3_url}','regionByPx',json_build_array(${options.iiif_data.regionByPx}))`:`json_object('{image_service3_url,${options.iiif_data.image_service3_url}}')`;
  }

  // TODO: images which are in state "waiting_validation" or "validated" should
  // probably have the following attributes randomly generated: azimuth, tilt,
  // roll, focal, location, apriori_altitude, view_type, date_shot_min, date_shot_max,
  // caption, height, width, date_orig, last_start, last_start_user_id,
  // geolocalisation_id, country_iso_a2
  let location = null;
  if (longitude && latitude) {
    altitude = altitude ? altitude : 0;
    location = `ST_setSRID(ST_MakePoint(${longitude}, ${latitude}, ${altitude}), 4326)`;
  } else {
    longitude = null;
    latitude = null,
    altitude = null;
  }
  const user_id = user ? user.id : null;
  const columns = {
    collection_id,
    owner_id: owner.id,
    name: getOrGenerate(options, 'name', () => chance.sentence({ words: 3 }).slice(0, 40)),
    title: getOrGenerate(options, 'title', () => chance.sentence({ words: 3 }).slice(0, 40)),
    date_inserted: getOrGenerate(options, 'date_inserted', () => new Date()),
    date_shot: getOrGenerate(options, 'date_shot', () => new Date()),
    date_georef: get(options, 'date_georef', null),
    link: getOrGenerate(options, 'link', () => chance.url({ domain: 'localhost.localdomain' })),
    license: getOrGenerate(options, 'license', () => chance.paragraph()),
    azimuth: get(options, 'azimuth', null),
    tilt: get(options, 'tilt', null),
    roll: get(options, 'roll', null),
    focal: get(options, 'focal', null),
    px: get(options, 'px', null),
    py: get(options, 'py', null),
    location: location,
    user_id: get(options, 'user_id', user_id),
    geotags_array: get(options, 'geotags_array', []),
    view_type: get(options, 'view_type', chance.pickone(view_types)),
    apriori_altitude: get(options, 'apriori_altitude', null),
    validator_id: get(options, 'validator_id', null),
    is_published: get(options, 'is_published', true),
    exact_date: get(options, 'exact_date', false),
    date_shot_min: get(options, 'date_shot_min', null),
    date_shot_max: get(options, 'date_shot_max', null),
    original_id: getOrGenerate(options, 'original_id', () => chance.sentence({ words: 3 }).slice(0, 40)),
    link_id: get(options, 'link_id', null),
    caption: get(options, 'caption', null),
    height: get(options, 'height', null),
    width: get(options, 'width', null),
    orig_title: getOrGenerate(options, 'orig_title', () => chance.sentence({ words: 3 }).slice(0, 40)),
    orig_caption: get(options, 'orig_caption', null),
    correction_enabled: get(options, 'correction_enabled', false),
    observation_enabled: get(options, 'observation_enabled', false),
    download_link: get(options, 'download_link', null),
    date_orig: get(options, 'date_orig', null),
    downloaded: get(options, 'downloaded', false),
    download_timestamp: get(options, 'download_timestamp', null),
    footprint: get(options, 'footprint', null),
    viewshed_simple: get(options, 'viewshed_simple', null),
    viewshed_precise: get(options, 'viewshed_precise', null),
    viewshed_created: get(options, 'viewshed_created', false),
    viewshed_timestamp: get(options, 'viewshed_timestamp', null),
    geotag_created: get(options, 'geotag_created', false),
    geotag_timestamp: get(options, 'geotag_timestamp', null),
    geotags_json: get(options, 'geotags_json', null),
    date_validated: get(options, 'date_validated', null),
    last_start: get(options, 'last_start', null),
    last_start_user_id: get(options, 'last_start_user_id', null),
    shop_link: get(options, 'shop_link', null),
    geolocalisation_id: get(options, 'geolocalisation_id', null),
    original_state: get(options, 'original_state', 'initial'),
    state: get(options, 'state', 'initial'),
    country_iso_a2: get(options, 'country_iso_a2', null),
    iiif_data: iiif_data,
    last_login: null,
    framing_mode: get(options, 'framing_mode', chance.pickone(framing_modes))
  };

  const result = await sequelize.query(
    `
      INSERT INTO images
      (
        collection_id, owner_id, name, date_inserted, date_shot, date_georef,
        link, license, azimuth, tilt, roll, focal, px, py, location,
        user_id, geotags_array, view_type, apriori_altitude,
        validator_id, is_published, exact_date, date_shot_min, date_shot_max, original_id,
        link_id, title, caption, height, width, orig_title, orig_caption,
        correction_enabled, observation_enabled, download_link, date_orig,
        downloaded, download_timestamp, footprint, viewshed_simple, viewshed_precise,
        viewshed_created, viewshed_timestamp, geotag_created, geotag_timestamp,
        geotags_json, date_validated, last_start, last_start_user_id, shop_link,
        geolocalisation_id, state, original_state, country_iso_a2, iiif_data, framing_mode
      )
      VALUES (
        :collection_id, :owner_id, :name, :date_inserted, :date_shot, :date_georef,
        :link, :license, :azimuth, :tilt, :roll, :focal, :px, :py, ${location},
        :user_id, array[:geotags_array]::text[], :view_type, :apriori_altitude,
        :validator_id, :is_published, :exact_date, :date_shot_min, :date_shot_max, :original_id,
        :link_id, :title, :caption, :height, :width, :orig_title, :orig_caption,
        :correction_enabled, :observation_enabled, :download_link, :date_orig,
        :downloaded, :download_timestamp, :footprint, :viewshed_simple, :viewshed_precise,
        :viewshed_created, :viewshed_timestamp, :geotag_created, :geotag_timestamp,
        :geotags_json, :date_validated, :last_start, :last_start_user_id, :shop_link,
        :geolocalisation_id, :state, :original_state, :country_iso_a2, ${iiif_data}, :framing_mode
      )
      RETURNING id
    `,
    {
      replacements: columns,
      type: QueryTypes.INSERT
    }
  );

  const rows = result[0];
  const insertedImage = rows[0];

  // generate apriori_location if given (at least apriori longitude and latitude required)
  if (apriori_longitude && apriori_latitude){
    await createAPrioriLocation({
      image_id: insertedImage.id,
      original_id: insertedImage.original_id,
      azimuth: apriori_azimuth,
      longitude: apriori_longitude,
      latitude: apriori_latitude,
      exact: apriori_exact
    });
  }

  //generate photographers association
  const insertedPhotographers=[];
  if (photographers) { //photographers provided
    insertedPhotographers.push(...photographers);
  } else {
    //none provided
    const photographerAnonym = await createPhotographer({ first_name: null, last_name: 'Anonyme', link: null, company: null });
    insertedPhotographers.push(photographerAnonym);
  }
  for (const insertedPhotographer of insertedPhotographers) {
    await createImagesPhotographers({
      image_id: insertedImage.id,
      photographer_id: insertedPhotographer.id
    })
  }

  return {
    ...columns,
    collection,
    owner,
    user,
    latitude: latitude,
    longitude: longitude,
    altitude: altitude,
    photographers: insertedPhotographers,
    id: insertedImage.id
  };
};
