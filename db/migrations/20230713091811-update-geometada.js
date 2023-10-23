'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE public.geometadata
      DROP COLUMN IF EXISTS viewshed_precise_status CASCADE;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE public.geometadata
      DROP COLUMN IF EXISTS  viewshed_precise_timestamp CASCADE;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE public.images
      DROP COLUMN IF EXISTS viewshed_precise_status;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE public.images
      DROP COLUMN IF EXISTS viewshed_precise_timestamp;
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

            RETURN NEW;
        END
        $$
    LANGUAGE 'plpgsql';

    DROP TRIGGER IF EXISTS update_viewsheds_status_but ON public.geometadata;

    CREATE TRIGGER update_viewsheds_status_but
        BEFORE UPDATE OF viewshed_simple
        ON public.geometadata
        FOR EACH ROW
        EXECUTE PROCEDURE public.set_viewsheds_status();
    --------------------------------------------------------------------------------
    CREATE OR REPLACE FUNCTION "public"."set_toponyms_status"()
        RETURNS trigger AS
        $$
        BEGIN
            IF (OLD.viewshed_simple IS NOT NULL) THEN
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
      ALTER TABLE public.geometadata
      ADD COLUMN viewshed_precise_status computation_statuses NOT NULL DEFAULT 'not computed', viewshed_precise_timestamp TIMESTAMPTZ DEFAULT NULL;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE public.images
      ADD COLUMN viewshed_precise_status computation_statuses NOT NULL DEFAULT 'not computed', viewshed_precise_timestamp TIMESTAMPTZ DEFAULT NULL;
    `);
  }
};
