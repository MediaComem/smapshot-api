DROP TRIGGER IF EXISTS update_points_vt_trigger ON images;
DROP TRIGGER IF EXISTS insert_points_vt ON images;
DROP TRIGGER IF EXISTS delete_points_vt ON images;
DROP TRIGGER IF EXISTS update_points_vt ON images;
DROP FUNCTION IF EXISTS update_points_vt;
DROP FUNCTION IF EXISTS update_single_points_vt;

CREATE OR REPLACE FUNCTION update_single_points_vt() RETURNS trigger AS $$
BEGIN
  -- Add id from vt layer
  IF new.state IN ('initial', 'waiting_alignment', 'validated') AND new.is_published = TRUE
  THEN
    PERFORM pg_notify(
      CASE WHEN new.state = 'validated' THEN 'update_vt_visit' ELSE 'update_vt_contribute' END,
      json_build_object(
        'action', 'add',
        'ref', new.id
      )::text
    );
  END IF;
  -- Remove id from vt layer
  IF old.state IN ('initial', 'waiting_alignment', 'validated') AND old.is_published = TRUE OR new.is_published = FALSE
  THEN
    PERFORM pg_notify(
      CASE WHEN old.state = 'validated' THEN 'update_vt_visit' ELSE 'update_vt_contribute' END,
      json_build_object(
        'action', 'remove',
        'ref', new.id
      )::text
    );
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_bulk_points_vt() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('update_vt_visit'::text, json_build_object()::text);
  PERFORM pg_notify('update_vt_contribute'::text, json_build_object()::text);

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER insert_points_vt AFTER INSERT on images
FOR EACH STATEMENT EXECUTE PROCEDURE update_bulk_points_vt();

CREATE TRIGGER delete_points_vt AFTER DELETE on images
FOR EACH STATEMENT EXECUTE PROCEDURE update_bulk_points_vt();

CREATE TRIGGER update_points_vt AFTER UPDATE on images
FOR EACH ROW WHEN (OLD.state <> new.state OR old.is_published <> new.is_published)
EXECUTE PROCEDURE update_single_points_vt();

