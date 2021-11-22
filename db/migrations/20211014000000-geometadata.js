'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      CREATE TYPE computation_statuses AS ENUM (
        'not computed', 'computing', 'computed', 'rejected', 'updated'
      );
    `);
    await queryInterface.sequelize.query(`
    CREATE TABLE IF NOT EXISTS geometadata (
        id INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        fk_image_id INT references images (id),
        footprint Geometry('MultiPolygon',4326,2) DEFAULT NULL,
        viewshed_precise Geometry('MultiPolygon',4326,2) DEFAULT NULL,
        viewshed_simple Geometry('MultiPolygon',4326,2) DEFAULT NULL,
        toponyms_array text[] NOT NULL DEFAULT '{}'::text[],
        toponyms_json JSON DEFAULT NULL,
        footprint_status computation_statuses NOT NULL DEFAULT 'not computed',
        viewshed_precise_status computation_statuses NOT NULL DEFAULT 'not computed',
        viewshed_simple_status computation_statuses NOT NULL DEFAULT 'not computed',
        toponyms_status computation_statuses NOT NULL DEFAULT 'not computed',
        footprint_timestamp TIMESTAMPTZ DEFAULT NULL,
        viewshed_simple_timestamp TIMESTAMPTZ DEFAULT NULL,
        viewshed_precise_timestamp TIMESTAMPTZ DEFAULT NULL,
        toponyms_timestamp TIMESTAMPTZ DEFAULT NULL,
        git_revision_hash BYTEA DEFAULT NULL
      );
      INSERT INTO public.geometadata (fk_image_id) SELECT id FROM images;
      WITH cte AS (
        SELECT DISTINCT ON (geoloc.image_id) geoloc.image_id, geoloc.footprint
        FROM images i
        INNER JOIN geolocalisations geoloc
        ON i.id = geoloc.image_id
        WHERE geoloc.footprint IS NOT NULL
        AND geoloc.state in ('validated', 'improved')
        ORDER BY geoloc.image_id, geoloc.date_validated DESC
      )
      UPDATE public.geometadata g
      SET
        footprint = cte.footprint,
        footprint_status = 'computed'
      FROM cte
      WHERE g.fk_image_id = cte.image_id;
    `);
    await queryInterface.sequelize.query(`
    CREATE OR REPLACE FUNCTION "public"."set_timestamp"()
        RETURNS trigger AS
        $$
        BEGIN
            IF NEW.viewshed_simple IS NOT NULL
            --AND NEW.viewshed_simple IS DISTINCT FROM OLD.viewshed_simple
            AND NEW.viewshed_simple_timestamp IS NULL
            THEN
                NEW.viewshed_simple_timestamp = NOW();
            END IF;

            IF NEW.viewshed_precise IS NOT NULL
            --AND NEW.viewshed_precise IS DISTINCT FROM OLD.viewshed_precise
            AND NEW.viewshed_precise_timestamp IS NULL
            THEN
                NEW.viewshed_precise_timestamp = NOW();
            END IF;

            IF (NEW.toponyms_array != '{}' AND NEW.toponyms_array IS NOT NULL)
            --AND NEW.toponyms_array IS DISTINCT FROM OLD.toponyms_array
            AND NEW.toponyms_timestamp IS NULL
            THEN
                NEW.toponyms_timestamp = NOW();
            END IF;
            --NEW.test = ARRAY(SELECT * FROM jsonb_object_keys(to_jsonb(NEW)));
            RETURN NEW;
        END
        $$
    LANGUAGE 'plpgsql';

    DROP TRIGGER IF EXISTS update_timestamps_biut ON public.geometadata;

    CREATE TRIGGER update_timestamps_biut
        BEFORE INSERT OR UPDATE
        ON public.geometadata
        FOR EACH ROW
        EXECUTE PROCEDURE public.set_timestamp();
    --------------------------------------------------------------------------------
    CREATE OR REPLACE FUNCTION "public"."set_viewsheds_status"()
        RETURNS trigger AS
        $$
        BEGIN
            IF (NEW.viewshed_simple IS NULL AND NEW.viewshed_simple_status = 'not computed') THEN
                NEW.viewshed_simple_status = 'not computed';
            ELSEIF (NEW.viewshed_simple IS NULL AND NEW.viewshed_simple_status <> 'not computed') THEN
                NEW.viewshed_simple_status = 'rejected';
            ELSEIF (NEW.viewshed_simple IS NOT NULL) THEN
                IF OLD.viewshed_simple_status = 'not computed' THEN
                    NEW.viewshed_simple_status = 'computed';
                ELSEIF OLD.viewshed_simple_status IN ('computed', 'updated', 'rejected') THEN
                    NEW.viewshed_simple_status = 'updated';
                END IF;
            ELSE
                NEW.viewshed_simple_status = OLD.viewshed_simple_status; --keep existing by default
            END IF;

            IF (NEW.viewshed_precise IS NULL AND NEW.viewshed_precise_status = 'not computed') THEN
                NEW.viewshed_precise_status = 'not computed';
            ELSEIF (NEW.viewshed_precise IS NULL AND NEW.viewshed_precise_status <> 'not computed') THEN
                NEW.viewshed_precise_status = 'rejected';
            ELSEIF (NEW.viewshed_precise IS NOT NULL) THEN
                IF OLD.viewshed_precise_status = 'not computed' THEN
                    NEW.viewshed_precise_status = 'computed';
                ELSEIF OLD.viewshed_precise_status IN ('computed', 'updated', 'rejected') THEN
                    NEW.viewshed_precise_status = 'updated';
                END IF;
            ELSE
                NEW.viewshed_precise_status = OLD.viewshed_precise_status; --keep existing by default
            END IF;
            RETURN NEW;
        END
        $$
    LANGUAGE 'plpgsql';

    DROP TRIGGER IF EXISTS update_viewsheds_status_but ON public.geometadata;

    CREATE TRIGGER update_viewsheds_status_but
        BEFORE UPDATE OF viewshed_simple, viewshed_precise
        ON public.geometadata
        FOR EACH ROW
        EXECUTE PROCEDURE public.set_viewsheds_status();
    --------------------------------------------------------------------------------
    CREATE OR REPLACE FUNCTION "public"."set_toponyms_status"()
        RETURNS trigger AS
        $$
        BEGIN
            IF (OLD.viewshed_precise IS NOT NULL) THEN
                IF (NEW.toponyms_array = '{}' OR NEW.toponyms_array IS NULL) AND NEW.toponyms_status = 'not computed' THEN
                    NEW.toponyms_status = 'not computed';
                ELSEIF (NEW.toponyms_array = '{}' OR NEW.toponyms_array IS NULL) AND (NEW.toponyms_status <> 'not computed') THEN
                    NEW.toponyms_status = 'rejected';
                ELSEIF (NEW.toponyms_array != '{}' AND NEW.toponyms_array IS NOT NULL) THEN
                    IF OLD.toponyms_status = 'not computed' THEN
                        NEW.toponyms_status = 'computed';
                    ELSEIF OLD.toponyms_status IN ('computed', 'updated', 'rejected') THEN
                        NEW.toponyms_status = 'updated';
                    END IF;
                ELSE
                    NEW.toponyms_status = OLD.toponyms_status;--keep existing by default
                END IF;
            END IF;
            RETURN NEW;
        END
        $$
    LANGUAGE 'plpgsql';

    DROP TRIGGER IF EXISTS update_toponyms_status_but ON public.geometadata;

    CREATE TRIGGER update_toponyms_status_but
        BEFORE UPDATE OF toponyms_array, toponyms_json
        ON public.geometadata
        FOR EACH ROW
        EXECUTE PROCEDURE public.set_toponyms_status();
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS update_timestamps_biut ON public.geometadata;
      DROP TRIGGER IF EXISTS update_viewsheds_status_but ON public.geometadata;
      DROP TRIGGER IF EXISTS update_toponyms_status_but ON public.geometadata;
    `);
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS public.geometadata;
    `);
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS computation_statuses;
    `);
  }
};
