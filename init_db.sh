#!/bin/bash

set -e

NPROC=$(nproc)
JOBS=$((NPROC-1))
# This variable is used by the legacy code:
POSTGRES_DB="smapshot"

# Check if the dump file is existing. This files must be made available as a
# bind mount in the "db" service of the Compose file.
if [[ -f "/tmp/dump.sql" ]];
then
  DUMP_FILE="/tmp/dump.sql"
else
  # We exit the initialization script
  printf "%s\n" \
    "WARNING: No database dump set up in the db service of the Compose file." \
    "         It is therfore assumed that you already have an initialized database." \
    "         Otherwise ask for a fresh dump from the prod database," \
    "         and uncomment the line containing the DUMP_PATH variable" \
    "         under the volumes section of the db service in the Compose file." \
    "Exiting intialization script now. Bye."
    exit 1
fi

# Start with a clean database for psql to work with hereafter
echo "INFO: Setting up the \"${POSTGRES_DB}\" database..."
psql \
  -U "${POSTGRES_USER}" \
  -d "postgres" \
  -c "DROP DATABASE IF EXISTS ${POSTGRES_DB};" \
  -c "CREATE DATABASE ${POSTGRES_DB};"

echo "INFO: \"${POSTGRES_DB}\" database created with: SUCCESS!"

echo "INFO: Creating role smapshot..."
  psql \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    -c "CREATE ROLE smapshot;" \
    -v ON_ERROR_STOP=1

echo "INFO: smapshot role created with: SUCCESS!"

if [[ $(pg_restore -l "${DUMP_FILE}" 2>/dev/null) ]];
then
  echo "INFO: restoring DB with pg_restore using ${JOBS} job(s), please wait..."
  pg_restore \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    --jobs=${JOBS} \
    "${DUMP_FILE}"
  echo "INFO: dump \"${DUMP_FILE}\" restored with pg_restore with: SUCCESS!"
else
  # Legacy code; should be avoided because it has many flaws:
  # Create the smapshot role to avoid the following error:
  # psql:/tmp/dump.sql:1814634: ERROR: role "smapshot" does not exist
  echo "INFO: restoring the smapshot database with psql, please wait..."
  psql \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    -f "${DUMP_FILE}"
    #-v ON_ERROR_STOP=1 # this sanity check SHOULD be activated, but the dump is not clean.

  #rm -rf "${DUMP_FILE}"

  echo "INFO: dump file \"${DUMP_FILE}\" restored with psql with: SUCCESS!"
fi

echo "INFO: creating default user..."
psql \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  -c "INSERT INTO public.users (first_name, last_name, email, username, date_registr, letter, lang, \"password\", roles, active)
  VALUES ('Franck', 'Dulin', 'super_admin@smapshot.ch', 'super_admin', now(), TRUE, 'fr','\$2b\$12\$v80JamELNdJnvHyVAQrUZOaIRJJ2BI48vTsZop4s5mgoA9jbcX4Ni','{volunteer,super_admin}',TRUE);"

echo "INFO: default user created with: SUCCESS!"
