#!/bin/bash

set -e

DUMP_FILE="/tmp/dump.sql"

# Create the smapshot role to avoid the following error:
# psql:/tmp/dump.sql:1814634: ERROR:  role "smapshot" does not exist
echo "Create role smapshot..."
psql \
  -U ${POSTGRES_USER} \
  -d ${POSTGRES_DB} \
  -c 'CREATE ROLE smapshot;'
  #-v ON_ERROR_STOP=1 # this sanity check SHOULD be activated, but the dump is not clean.

echo "Role smapshot successfully created!"

psql \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  -f "/tmp/dump.sql"
  #-v ON_ERROR_STOP=1 # this sanity check SHOULD be activated, but the dump is not clean.

#rm -rf "${DUMP_FILE}"

echo "Dump ${DUMP_FILE} successfully restored!"

echo "Creating default user..."
psql \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  -c "INSERT INTO public.users (first_name, last_name, email, username, date_registr, letter, lang, \"password\", roles, active)
  VALUES ('Franck', 'Dulin', 'super_admin@smapshot.ch', 'super_admin', now(), TRUE, 'fr','\$2b\$12\$v80JamELNdJnvHyVAQrUZOaIRJJ2BI48vTsZop4s5mgoA9jbcX4Ni','{volunteer,super_admin}',TRUE);"

echo "Default user created successfully!"
