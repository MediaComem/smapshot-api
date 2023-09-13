--
-- PostgreSQL database dump
--

-- Dumped from database version 11.2
-- Dumped by pg_dump version 11.2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', 'public', false);
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: statistics; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS statistics;


--
-- Name: topology; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS topology;


--
-- Name: SCHEMA topology; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA topology IS 'PostGIS Topology schema';


--
-- Name: fuzzystrmatch; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS fuzzystrmatch WITH SCHEMA public;


--
-- Name: EXTENSION fuzzystrmatch; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION fuzzystrmatch IS 'determine similarities and distance between strings';


--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry, geography, and raster spatial types and functions';


--
-- Name: postgis_topology; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis_topology WITH SCHEMA topology;


--
-- Name: EXTENSION postgis_topology; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis_topology IS 'PostGIS topology spatial types and functions';


--
-- Name: bad_geoloc_result; Type: DOMAIN; Schema: public; Owner: -
--

CREATE DOMAIN public.bad_geoloc_result AS text
	CONSTRAINT valid_bad_geoloc_result CHECK ((VALUE = ANY (ARRAY['rejected'::text, 'validated'::text, NULL::text])));


--
-- Name: correction_check_result; Type: DOMAIN; Schema: public; Owner: -
--

CREATE DOMAIN public.correction_check_result AS text
	CONSTRAINT valid_correction_result CHECK ((VALUE = ANY (ARRAY['accepted'::text, 'rejected'::text])));


--
-- Name: correction_type; Type: DOMAIN; Schema: public; Owner: -
--

CREATE DOMAIN public.correction_type AS text
	CONSTRAINT valid_correction_type CHECK ((VALUE = ANY (ARRAY['title'::text, 'caption'::text])));


--
-- Name: images_view_type; Type: DOMAIN; Schema: public; Owner: -
--

CREATE DOMAIN public.images_view_type AS text
	CONSTRAINT valid_images_view_type CHECK ((VALUE = ANY (ARRAY['terrestrial'::text, 'lowOblique'::text, 'highOblique'::text, 'nadir'::text, NULL::text])));


--
-- Name: images_views_type; Type: DOMAIN; Schema: public; Owner: -
--

CREATE DOMAIN public.images_views_type AS text
	CONSTRAINT valid_images_views_type CHECK ((VALUE = ANY (ARRAY['2D'::text, '3D'::text])));


--
-- Name: images_views_viewer_origin; Type: DOMAIN; Schema: public; Owner: -
--

CREATE DOMAIN public.images_views_viewer_origin AS text
	CONSTRAINT valid_images_views_viewer_origin CHECK ((VALUE = ANY (ARRAY['georeferencer'::text, 'visit'::text])));


--
-- Name: _final_median(numeric[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._final_median(numeric[]) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    AS $_$
   SELECT AVG(val)
   FROM (
     SELECT val
     FROM unnest($1) val
     ORDER BY 1
     LIMIT  2 - MOD(array_upper($1, 1), 2)
     OFFSET CEIL(array_upper($1, 1) / 2.0) - 1
   ) sub;
$_$;


--
-- Name: json2arr(json); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.json2arr(_json json) RETURNS json
    LANGUAGE sql IMMUTABLE
    AS $$SELECT array_to_json(ARRAY(SELECT(json_each(_json)).value ORDER BY (json_each(_json)).key ASC)) $$;


--
-- Name: update_image_country(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_image_country() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF ST_Equals(new.location,old.location) = FALSE OR (old.location IS NULL AND new.location IS NOT NULL)
 THEN
	update images set country_iso_a2 = countries.iso_a2
	from countries where st_intersects(countries.wkb_geometry, new.location)
	and images.id = new.id;
	RETURN NEW;
 ELSE
	RETURN NEW;
 END IF;
END$$;


--
-- Name: median(numeric); Type: AGGREGATE; Schema: public; Owner: -
--

CREATE AGGREGATE public.median(numeric) (
    SFUNC = array_append,
    STYPE = numeric[],
    INITCOND = '{}',
    FINALFUNC = public._final_median
);


SET default_tablespace = '';

SET default_with_oids = false;

--
-- Name: apriori_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.apriori_locations (
    image_id integer,
    original_id text,
    geom public.geometry(PointZ,4326),
    id integer NOT NULL
);


--
-- Name: TABLE apriori_locations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.apriori_locations IS 'Potential area where the image could be located before geolocation';


--
-- Name: apriori_locations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.apriori_locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: apriori_locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.apriori_locations_id_seq OWNED BY public.apriori_locations.id;


--
-- Name: collections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collections (
    id integer NOT NULL,
    name json NOT NULL,
    owner_id integer,
    link character varying(255),
    description json,
    is_owner_challenge boolean DEFAULT false,
    date_publi timestamp with time zone,
    banner_id integer,
    is_main_challenge boolean DEFAULT false
);


--
-- Name: TABLE collections; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.collections IS 'Collections of images provided by owners';


--
-- Name: collections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.collections_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: collections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.collections_id_seq OWNED BY public.collections.id;


--
-- Name: corrections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.corrections (
    id integer NOT NULL,
    image_id integer,
    user_id integer,
    previous_correction_id integer,
    type public.correction_type,
    correction text,
    date_created timestamp with time zone,
    validator_id integer,
    date_validated timestamp without time zone,
    remark text,
    downloaded boolean DEFAULT false,
    download_timestamp timestamp without time zone,
    is_original boolean DEFAULT false,
    state text DEFAULT 'created'::text,
    CONSTRAINT state_check CHECK ((state = ANY (ARRAY['created'::text, 'accepted'::text, 'updated'::text, 'rejected'::text])))
);


--
-- Name: TABLE corrections; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.corrections IS 'Propositions of images metatada from the volunteers. e.g. title, caption...';


--
-- Name: corrections_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.corrections_id_seq1
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: corrections_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.corrections_id_seq1 OWNED BY public.corrections.id;


--
-- Name: countries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.countries (
    ogc_fid integer NOT NULL,
    name character varying,
    iso_a2 character varying,
    wkb_geometry public.geometry(Geometry,4326)
);


--
-- Name: countries_ogc_fid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.countries_ogc_fid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: countries_ogc_fid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.countries_ogc_fid_seq OWNED BY public.countries.ogc_fid;


--
-- Name: errors_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.errors_type (
    id integer NOT NULL,
    title text,
    translations json
);


--
-- Name: TABLE errors_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.errors_type IS 'Translated geolocalisations errors types';


--
-- Name: errors_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.errors_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: errors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.errors_id_seq OWNED BY public.errors_type.id;


--
-- Name: geolocalisations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geolocalisations (
    image_id integer NOT NULL,
    user_id integer NOT NULL,
    validator_id integer,
    errors_list integer[],
    remark text,
    date_validated timestamp with time zone,
    date_seen date,
    date_georef timestamp with time zone,
    start time with time zone,
    stop time with time zone,
    id integer NOT NULL,
    gcp_json json,
    location public.geometry(PointZ,4326),
    azimuth numeric,
    tilt numeric,
    roll numeric,
    focal numeric,
    px numeric,
    py numeric,
    score numeric,
    surface_ratio integer,
    n_gcp integer,
    date_checked timestamp with time zone,
    footprint public.geometry(Polygon,4326),
    previous_geolocalisation_id integer,
    state text DEFAULT 'created'::text,
    CONSTRAINT state_check CHECK ((state = ANY (ARRAY['created'::text, 'waiting_validation'::text, 'validated'::text, 'improved'::text, 'rejected'::text])))
);


--
-- Name: TABLE geolocalisations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.geolocalisations IS 'All attempts to geolocalise an image';


--
-- Name: COLUMN geolocalisations.date_georef; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.geolocalisations.date_georef IS 'Same as stop attribute but with the date';


--
-- Name: geolocalisations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.geolocalisations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: geolocalisations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.geolocalisations_id_seq OWNED BY public.geolocalisations.id;


--
-- Name: images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.images (
    id integer NOT NULL,
    name character varying(40),
    date_inserted timestamp without time zone,
    date_shot date,
    date_georef date,
    title text,
    link text,
    license text,
    azimuth numeric,
    tilt numeric,
    roll numeric,
    focal numeric,
    px numeric,
    py numeric,
    location public.geometry(PointZ,4326),
    collection_id integer,
    owner_id integer,
    photographer_id integer,
    user_id integer,
    geotags_array text[] DEFAULT '{}'::text[] NOT NULL,
    view_type public.images_view_type,
    apriori_altitude numeric,
    validator_id integer,
    is_published boolean DEFAULT true,
    exact_date boolean DEFAULT true,
    date_min date,
    date_max date,
    original_id character varying(50),
    link_id character varying(50),
    caption text,
    height integer,
    width integer,
    orig_title text,
    orig_caption text,
    correction_enabled boolean DEFAULT false,
    observation_enabled boolean DEFAULT false,
    download_link text,
    date_orig text DEFAULT 'Null'::text,
    downloaded boolean DEFAULT false,
    download_timestamp timestamp without time zone,
    viewshed_simple public.geometry(MultiPolygon,4326),
    viewshed_created boolean DEFAULT false,
    geotag_created boolean DEFAULT false,
    geotag_timestamp timestamp without time zone,
    viewshed_timestamp timestamp without time zone,
    geotags_json json,
    date_validated timestamp without time zone,
    viewshed_precise public.geometry(MultiPolygon,4326),
    last_start timestamp without time zone,
    shop_link text,
    geolocalisation_id integer,
    state text DEFAULT 'not_georef'::text,
    country_iso_a2 character varying(2),
    last_start_user_id integer,
    CONSTRAINT state_check CHECK ((state = ANY (ARRAY['not_georef'::text, 'waiting_validation'::text, 'validated'::text, 'impossible'::text])))
);


--
-- Name: COLUMN images.date_inserted; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.images.date_inserted IS 'Date ON which the image was put in the database';


--
-- Name: COLUMN images.is_published; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.images.is_published IS 'Allow to temporarily disabled publication';


--
-- Name: COLUMN images.exact_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.images.exact_date IS 'If true then date_shot is relevant, otherwise min_date and max_date';


--
-- Name: COLUMN images.link_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.images.link_id IS 'ID of the metadata file provided by the owner';


--
-- Name: COLUMN images.correction_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.images.correction_enabled IS 'Allow metadata propositions from volunteer';


--
-- Name: COLUMN images.date_orig; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.images.date_orig IS 'Original text format date exclusively for ETHZ';


--
-- Name: COLUMN images.downloaded; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.images.downloaded IS 'For owners, to know if data have already been downloaded';


--
-- Name: COLUMN images.last_start; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.images.last_start IS 'Lock to prevent concurrent geolocation';


--
-- Name: COLUMN images.last_start_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.images.last_start_user_id IS 'Lock to prevent concurrent geolocation';


--
-- Name: images_downloads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.images_downloads (
    id integer NOT NULL,
    image_id integer,
    date timestamp with time zone
);


--
-- Name: TABLE images_downloads; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.images_downloads IS 'Count downloads of images';


--
-- Name: images_downloads_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.images_downloads_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: images_downloads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.images_downloads_id_seq OWNED BY public.images_downloads.id;


--
-- Name: images_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.images_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: images_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.images_id_seq OWNED BY public.images.id;


--
-- Name: images_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.images_views (
    id integer NOT NULL,
    image_id integer,
    date timestamp with time zone,
    viewer_type public.images_views_type,
    viewer_origin public.images_views_viewer_origin
);


--
-- Name: TABLE images_views; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.images_views IS 'Count views of images';


--
-- Name: images_views_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.images_views_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: images_views_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.images_views_id_seq OWNED BY public.images_views.id;


--
-- Name: observations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.observations (
    id integer NOT NULL,
    image_id integer,
    user_id integer,
    date_created date,
    observation text,
    coord_x numeric,
    coord_y numeric,
    remark text,
    width numeric,
    height numeric,
    validator_id integer,
    downloaded boolean DEFAULT false,
    download_timestamp timestamp without time zone,
    date_validated timestamp without time zone,
    state text DEFAULT 'created'::text,
    CONSTRAINT state_check CHECK ((state = ANY (ARRAY['created'::text, 'validated'::text, 'rejected'::text])))
);


--
-- Name: TABLE observations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.observations IS 'Comments/annotations wrote by volunteers';


--
-- Name: COLUMN observations.remark; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.observations.remark IS 'Remark from the validator';


--
-- Name: observations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.observations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: observations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.observations_id_seq OWNED BY public.observations.id;


--
-- Name: owners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.owners (
    id integer NOT NULL,
    name json NOT NULL,
    link character varying(200),
    slug character varying(60),
    description json,
    is_published boolean,
    banner_id integer,
    banner_col_id integer,
    extent double precision[]
);


--
-- Name: TABLE owners; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.owners IS 'Organisations owners which possess one or multiple collections';


--
-- Name: owners_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.owners_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: owners_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.owners_id_seq OWNED BY public.owners.id;


--
-- Name: photographers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.photographers (
    id integer NOT NULL,
    first_name character varying(100),
    last_name character varying(100),
    link character varying(200),
    company character varying(200)
);


--
-- Name: TABLE photographers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.photographers IS 'Metadata from the organisation or the photographer who shot an image';


--
-- Name: photographers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.photographers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: photographers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.photographers_id_seq OWNED BY public.photographers.id;


--
-- Name: problems; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.problems (
    id integer NOT NULL,
    image_id integer,
    user_id integer,
    date_created timestamp without time zone,
    title text,
    description text,
    validator_id integer,
    problem_type_id integer,
    state text DEFAULT 'created'::text,
    CONSTRAINT state_check CHECK ((state = ANY (ARRAY['created'::text, 'validated'::text, 'owner_processed'::text, 'admin_processed'::text])))
);


--
-- Name: TABLE problems; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.problems IS 'Images related issues submitted by volunteers';


--
-- Name: problems_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.problems_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: problems_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.problems_id_seq OWNED BY public.problems.id;


--
-- Name: problems_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.problems_type (
    id integer NOT NULL,
    title text NOT NULL,
    translations json NOT NULL,
    source text,
    CONSTRAINT source_check CHECK ((source = ANY (ARRAY['image'::text, 'geolocalisation'::text])))
);


--
-- Name: problems_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.problems_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: problems_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.problems_type_id_seq OWNED BY public.problems_type.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    first_name character varying(255),
    last_name character varying(255),
    password character varying(255),
    email character varying(255),
    username character varying(255),
    googleid character varying(255),
    facebookid character varying(255),
    letter boolean,
    nimages integer,
    date_registr timestamp without time zone,
    lang character varying(10),
    has_one_validated boolean DEFAULT false,
    reset_password_token character varying(1024),
    reset_password_expires date,
    roles text[] NOT NULL,
    owner_id integer,
    active boolean DEFAULT false,
    active_token character varying(1024),
    active_expires timestamp without time zone,
    CONSTRAINT roles_check CHECK ((roles <@ '{super_admin,owner_admin,owner_validator,volunteer}'::text[]))
);


--
-- Name: COLUMN users.nimages; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.nimages IS 'Count images validated';


--
-- Name: COLUMN users.has_one_validated; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.has_one_validated IS 'Means that it is not a first time user';


--
-- Name: Stories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE Stories (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  logo_link VARCHAR(255) NOT NULL
);

--
-- Name: Stories_chapters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE Stories_chapters (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(255) CHECK (type IN ('IMAGE', 'VIDEO', 'VIDEO-YOUTUBE', 'AUDIO')) NOT NULL,
  picture_id INTEGER NOT NULL
  CONSTRAINT fk_picture_id REFERENCES images(id),
  url_media TEXT NOT NULL,
  description TEXT NOT NULL,
  zoom INTEGER CHECK (zoom >= 0 AND zoom <= 22) NOT NULL,
  story INTEGER NOT NULL
  CONSTRAINT fk_story REFERENCES Stories(id),
  indexInStory INTEGER NOT NULL
);


--
-- Name: volunteers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.volunteers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: volunteers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.volunteers_id_seq OWNED BY public.users.id;


--
-- Name: distinct_users_by_collections; Type: VIEW; Schema: statistics; Owner: -
--

CREATE VIEW statistics.distinct_users_by_collections AS
 SELECT count(DISTINCT images.user_id) AS n_users,
    images.collection_id,
    ((collections.name -> 'fr'::text))::text AS text
   FROM (public.images
     LEFT JOIN public.collections ON ((images.collection_id = collections.id)))
  WHERE (images.state = 'validated'::text)
  GROUP BY images.collection_id, ((collections.name -> 'fr'::text))::text;


--
-- Name: minutes_spent_by_collection; Type: VIEW; Schema: statistics; Owner: -
--

CREATE VIEW statistics.minutes_spent_by_collection AS
 SELECT public.median(((((((date_part('hour'::text, ((geolocalisations.stop)::time without time zone - (geolocalisations.start)::time without time zone)) * (60)::double precision) * (60)::double precision) + (date_part('minute'::text, ((geolocalisations.stop)::time without time zone - (geolocalisations.start)::time without time zone)) * (60)::double precision)) + date_part('second'::text, ((geolocalisations.stop)::time without time zone - (geolocalisations.start)::time without time zone))))::numeric / (60)::numeric)) AS minutes,
    images.collection_id,
    ((collections.name -> 'fr'::text))::text AS text
   FROM ((public.geolocalisations
     LEFT JOIN public.images ON ((geolocalisations.image_id = images.id)))
     LEFT JOIN public.collections ON ((images.collection_id = collections.id)))
  WHERE ((geolocalisations.start IS NOT NULL) AND (geolocalisations.stop IS NOT NULL))
  GROUP BY images.collection_id, ((collections.name -> 'fr'::text))::text
  ORDER BY images.collection_id;


--
-- Name: ranking_by_collection; Type: VIEW; Schema: statistics; Owner: -
--

CREATE VIEW statistics.ranking_by_collection AS
 SELECT count(images.user_id) AS c,
    users.username,
    images.collection_id,
    ((collections.name -> 'fr'::text))::text AS text
   FROM ((public.images
     LEFT JOIN public.users ON ((images.user_id = users.id)))
     LEFT JOIN public.collections ON ((images.collection_id = collections.id)))
  GROUP BY images.user_id, users.username, images.collection_id, ((collections.name -> 'fr'::text))::text
  ORDER BY images.collection_id, (count(images.user_id)) DESC;


--
-- Name: apriori_locations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apriori_locations ALTER COLUMN id SET DEFAULT nextval('public.apriori_locations_id_seq'::regclass);


--
-- Name: collections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections ALTER COLUMN id SET DEFAULT nextval('public.collections_id_seq'::regclass);


--
-- Name: corrections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.corrections ALTER COLUMN id SET DEFAULT nextval('public.corrections_id_seq1'::regclass);


--
-- Name: countries ogc_fid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.countries ALTER COLUMN ogc_fid SET DEFAULT nextval('public.countries_ogc_fid_seq'::regclass);


--
-- Name: errors_type id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.errors_type ALTER COLUMN id SET DEFAULT nextval('public.errors_id_seq'::regclass);


--
-- Name: geolocalisations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geolocalisations ALTER COLUMN id SET DEFAULT nextval('public.geolocalisations_id_seq'::regclass);


--
-- Name: images id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.images ALTER COLUMN id SET DEFAULT nextval('public.images_id_seq'::regclass);


--
-- Name: images_downloads id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.images_downloads ALTER COLUMN id SET DEFAULT nextval('public.images_downloads_id_seq'::regclass);


--
-- Name: images_views id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.images_views ALTER COLUMN id SET DEFAULT nextval('public.images_views_id_seq'::regclass);


--
-- Name: observations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observations ALTER COLUMN id SET DEFAULT nextval('public.observations_id_seq'::regclass);


--
-- Name: owners id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owners ALTER COLUMN id SET DEFAULT nextval('public.owners_id_seq'::regclass);


--
-- Name: photographers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photographers ALTER COLUMN id SET DEFAULT nextval('public.photographers_id_seq'::regclass);


--
-- Name: problems id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.problems ALTER COLUMN id SET DEFAULT nextval('public.problems_id_seq'::regclass);


--
-- Name: problems_type id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.problems_type ALTER COLUMN id SET DEFAULT nextval('public.problems_type_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.volunteers_id_seq'::regclass);


--
-- Name: apriori_locations apriori_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apriori_locations
    ADD CONSTRAINT apriori_locations_pkey PRIMARY KEY (id);


--
-- Name: collections collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_pkey PRIMARY KEY (id);


--
-- Name: corrections corrections_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.corrections
    ADD CONSTRAINT corrections_pkey1 PRIMARY KEY (id);


--
-- Name: countries countries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.countries
    ADD CONSTRAINT countries_pkey PRIMARY KEY (ogc_fid);


--
-- Name: users email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT email_unique UNIQUE (email);


--
-- Name: errors_type errors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.errors_type
    ADD CONSTRAINT errors_pkey PRIMARY KEY (id);


--
-- Name: geolocalisations geolocalisations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geolocalisations
    ADD CONSTRAINT geolocalisations_pkey PRIMARY KEY (id);


--
-- Name: images_downloads images_downloads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.images_downloads
    ADD CONSTRAINT images_downloads_pkey PRIMARY KEY (id);


--
-- Name: images images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.images
    ADD CONSTRAINT images_pkey PRIMARY KEY (id);


--
-- Name: images_views images_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.images_views
    ADD CONSTRAINT images_views_pkey PRIMARY KEY (id);


--
-- Name: observations observations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observations
    ADD CONSTRAINT observations_pkey PRIMARY KEY (id);


--
-- Name: owners owners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owners
    ADD CONSTRAINT owners_pkey PRIMARY KEY (id);


--
-- Name: photographers photographers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photographers
    ADD CONSTRAINT photographers_pkey PRIMARY KEY (id);


--
-- Name: problems problems_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.problems
    ADD CONSTRAINT problems_pkey PRIMARY KEY (id);


--
-- Name: problems_type problems_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.problems_type
    ADD CONSTRAINT problems_type_pkey PRIMARY KEY (id);


--
-- Name: users volunteers_facebookid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT volunteers_facebookid_key UNIQUE (facebookid);


--
-- Name: users volunteers_googleid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT volunteers_googleid_key UNIQUE (googleid);


--
-- Name: users volunteers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT volunteers_pkey PRIMARY KEY (id);


--
-- Name: apriori_locations_gix; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX apriori_locations_gix ON public.apriori_locations USING gist (geom);

ALTER TABLE public.apriori_locations CLUSTER ON apriori_locations_gix;


--
-- Name: corrections_image_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX corrections_image_id_idx ON public.corrections USING btree (image_id);


--
-- Name: corrections_state_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX corrections_state_idx ON public.corrections USING btree (state);


--
-- Name: corrections_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX corrections_user_id_idx ON public.corrections USING btree (user_id);


--
-- Name: countries_wkb_geometry_geom_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX countries_wkb_geometry_geom_idx ON public.countries USING gist (wkb_geometry);


--
-- Name: geolocalisations_image_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX geolocalisations_image_id_idx ON public.geolocalisations USING btree (image_id);


--
-- Name: geolocalisations_state_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX geolocalisations_state_idx ON public.geolocalisations USING btree (state);


--
-- Name: geolocalisations_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX geolocalisations_user_id_idx ON public.geolocalisations USING btree (user_id);


--
-- Name: images_collection_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX images_collection_id_idx ON public.images USING btree (collection_id);


--
-- Name: images_gix; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX images_gix ON public.images USING gist (location);

ALTER TABLE public.images CLUSTER ON images_gix;


--
-- Name: images_lower_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX images_lower_idx ON public.images USING btree (lower(title));


--
-- Name: images_lower_idx1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX images_lower_idx1 ON public.images USING btree (lower(caption));


--
-- Name: images_lower_idx2; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX images_lower_idx2 ON public.images USING btree (lower((original_id)::text));


--
-- Name: images_owner_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX images_owner_id_idx ON public.images USING btree (owner_id);


--
-- Name: images_state_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX images_state_idx ON public.images USING btree (state);


--
-- Name: images_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX images_user_id_idx ON public.images USING btree (user_id);


--
-- Name: observations_image_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX observations_image_id_idx ON public.observations USING btree (image_id);


--
-- Name: observations_state_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX observations_state_idx ON public.observations USING btree (state);


--
-- Name: observations_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX observations_user_id_idx ON public.observations USING btree (user_id);


--
-- Name: problems_image_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX problems_image_id_idx ON public.problems USING btree (image_id);


--
-- Name: problems_state_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX problems_state_idx ON public.problems USING btree (state);


--
-- Name: problems_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX problems_user_id_idx ON public.problems USING btree (user_id);


--
-- Name: images update_image_country_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_image_country_trigger AFTER UPDATE ON public.images FOR EACH ROW EXECUTE PROCEDURE public.update_image_country();


--
-- Name: apriori_locations apriori_locations_image_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apriori_locations
    ADD CONSTRAINT apriori_locations_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.images(id);


--
-- Name: collections collections_banner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_banner_id_fkey FOREIGN KEY (banner_id) REFERENCES public.images(id);


--
-- Name: collections collections_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id);


--
-- Name: corrections corrections_image_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.corrections
    ADD CONSTRAINT corrections_image_id_fkey1 FOREIGN KEY (image_id) REFERENCES public.images(id);


--
-- Name: corrections corrections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.corrections
    ADD CONSTRAINT corrections_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: corrections corrections_validator_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.corrections
    ADD CONSTRAINT corrections_validator_id_fkey1 FOREIGN KEY (validator_id) REFERENCES public.users(id);


--
-- Name: images geolocalisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.images
    ADD CONSTRAINT geolocalisation_id_fkey FOREIGN KEY (geolocalisation_id) REFERENCES public.geolocalisations(id);


--
-- Name: geolocalisations geolocalisations_previous_geolocalisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geolocalisations
    ADD CONSTRAINT geolocalisations_previous_geolocalisation_id_fkey FOREIGN KEY (previous_geolocalisation_id) REFERENCES public.geolocalisations(id);


--
-- Name: images images_collections_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.images
    ADD CONSTRAINT images_collections_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id);


--
-- Name: images_downloads images_downloads_image_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.images_downloads
    ADD CONSTRAINT images_downloads_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.images(id);


--
-- Name: images images_owners_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.images
    ADD CONSTRAINT images_owners_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id);


--
-- Name: images images_photographers_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.images
    ADD CONSTRAINT images_photographers_id_fkey FOREIGN KEY (photographer_id) REFERENCES public.photographers(id);


--
-- Name: images_views images_views_image_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.images_views
    ADD CONSTRAINT images_views_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.images(id);


--
-- Name: images images_volunteers_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.images
    ADD CONSTRAINT images_volunteers_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: images last_start_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.images
    ADD CONSTRAINT last_start_user_id_fkey FOREIGN KEY (last_start_user_id) REFERENCES public.users(id);


--
-- Name: observations observations_image_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observations
    ADD CONSTRAINT observations_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.images(id);


--
-- Name: observations observations_validator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observations
    ADD CONSTRAINT observations_validator_id_fkey FOREIGN KEY (validator_id) REFERENCES public.users(id);


--
-- Name: observations observations_volunteer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observations
    ADD CONSTRAINT observations_volunteer_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: owners owner_banner_col_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owners
    ADD CONSTRAINT owner_banner_col_id_fkey FOREIGN KEY (banner_col_id) REFERENCES public.collections(id);


--
-- Name: owners owner_banner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owners
    ADD CONSTRAINT owner_banner_id_fkey FOREIGN KEY (banner_id) REFERENCES public.images(id);


--
-- Name: problems problems_image_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.problems
    ADD CONSTRAINT problems_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.images(id);


--
-- Name: problems problems_problem_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.problems
    ADD CONSTRAINT problems_problem_type_id_fkey FOREIGN KEY (problem_type_id) REFERENCES public.problems_type(id);


--
-- Name: problems problems_validator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.problems
    ADD CONSTRAINT problems_validator_id_fkey FOREIGN KEY (validator_id) REFERENCES public.users(id);


--
-- Name: problems problems_volunteer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.problems
    ADD CONSTRAINT problems_volunteer_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: users users_owner_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_owner_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id);


--
-- Name: geolocalisations validations_image_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geolocalisations
    ADD CONSTRAINT validations_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.images(id);


--
-- Name: geolocalisations validations_validator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geolocalisations
    ADD CONSTRAINT validations_validator_id_fkey FOREIGN KEY (validator_id) REFERENCES public.users(id);


--
-- Name: geolocalisations validations_volunteer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geolocalisations
    ADD CONSTRAINT validations_volunteer_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

