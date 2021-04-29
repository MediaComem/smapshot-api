CREATE OR REPLACE FUNCTION update_points_vt() RETURNS trigger AS $$
BEGIN
 -- When state changed, update vt
 IF old.state <> new.state
 THEN
 	-- Add id from vt layer
	IF new.state IN ('initial', 'waiting_alignment', 'validated')
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
	IF old.state IN ('initial', 'waiting_alignment', 'validated')
	THEN
		PERFORM pg_notify(
			CASE WHEN old.state = 'validated' THEN 'update_vt_visit' ELSE 'update_vt_contribute' END,
			json_build_object(
				'action', 'remove',
				'ref', new.id
			)::text
		);
	END IF;
 END IF;

 RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_points_vt_trigger ON images;

CREATE TRIGGER update_points_vt_trigger AFTER UPDATE on images
FOR EACH ROW EXECUTE PROCEDURE update_points_vt();
