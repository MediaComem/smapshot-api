DROP TRIGGER IF EXISTS update_points_vt_trigger ON images;
DROP TRIGGER IF EXISTS insert_points_vt ON images;
DROP TRIGGER IF EXISTS delete_points_vt ON images;
DROP TRIGGER IF EXISTS update_points_vt ON images;
DROP FUNCTION IF EXISTS update_points_vt;
DROP FUNCTION IF EXISTS update_single_points_vt;
DROP FUNCTIOn IF EXISTS update_bulk_points_vt;

CREATE OR REPLACE FUNCTION update_bulk_points_vt() RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify('update_vt_visit'::text, json_build_object()::text);
    PERFORM pg_notify('update_vt_contribute'::text, json_build_object()::text);

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER insert_points_vt AFTER INSERT OR UPDATE OR DELETE on images
FOR EACH STATEMENT EXECUTE PROCEDURE update_bulk_points_vt();

