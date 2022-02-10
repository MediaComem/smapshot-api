# smapshot api

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Project description](#project-description)
- [Initial setup](#initial-setup)
- [Develop with Docker Compose (recommended)](#develop-with-docker-compose-recommended)
    - [Requirements](#requirements)
    - [Setup](#setup)
    - [Run the application](#run-the-application)
    - [Run the automated tests](#run-the-automated-tests)
    - [Useful commands](#useful-commands)
- [Develop locally](#develop-locally)
    - [Setup](#setup-1)
    - [Run the application](#run-the-application-1)
    - [Run the automated tests](#run-the-automated-tests-1)
- [Development guide](#development-guide)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Project description

Smapshot is a crowdsourcing platform to geolocalize historical images in 3 dimension.
Production version is available at https://smapshot.heig-vd.ch

This project contains the code of the smapshot API available live at https://smapshot.heig-vd.ch/api/v1/
The online documentation is available at https://smapshot.heig-vd.ch/api/v1/docs/

## Initial setup

### Fetch (or ask for) a database dump

* As root on the production server:
  * `cp /data/backups/smapshot-backend/smapshot_database_daily/{datetime of the previous day}/smapshot_database_daily.tar /tmp/`
* As username on your local machine, run the following steps:
  * `scp {username}@{servername-or-ip}:/tmp/smapshot_database_daily.tar /home/{username}/Download/`
  * `cd /home/{username}/Download/`
  * `tar -xvf smapshot_database_daily.tar`
  * `cd ./smapshot_database_daily/databases/`
  * `gzip -d PostgreSQL.sql.gz`
  * `rm /home/{username}/Download/smapshot_database_daily.tar`
### Set your environment

* Copy the `.env.sample` file to `.env` and adapt it to your local environment.
  * Especially set up Facebook and Google OAuth credentials.
  * Set up the `DUMP_FILE` variable to reference the previousely fetched PostgreSQL database dump, e.g. `/home/{username}/Downloads/smapshot_database_daily/databases/PostgreSQL.sql`.

  > If you are developing with Docker Compose, you do not need to configure the database connection, as the database is created and configured for you.
* You can download sample images from [the Switch
  drive](https://drive.switch.ch/index.php/apps/files/?dir=/Smapshot/Sample%20Data&fileid=1891746707).
  Unzip the contents of the `data.zip` file into the `public/data` directory in this repository.

* A super admin demo account is created in the database during the intialization. It can be used to login in the API using the following information:
  * first_name: Frank
  * last_name: Dulin
  * email: super_admin@smapshot.ch
  * username: super_admin
  * password: super_admin

## Develop with Docker Compose (recommended)

### Requirements

* [Docker](https://www.docker.com/) 18.09+.
* [Docker Compose](https://docs.docker.com/compose/) 1.24+.

### Setup

Create and migrate the database:

```bash
npm run compose:migrate
```

### Run the application

Command                   | Description
:------------------------ | :------------------------------------------------------------------
`npm run compose:app`     | Start the application and install dependencies the first time.

Visit http://localhost:1337/docs/ once the application has started.

### Run the automated tests

Command                         | Description
:------------------------------ | :-------------------------------------------------------------------------
`npm run compose:test`          | Run the test suite.
`npm run compose:test:coverage` | Also generate a test coverage report (slower) in the `coverage` directory.
`npm run compose:test:debug`    | Run the test suite with verbose logs to help debug issues.

### Useful commands

Command                                  | Description
:--------------------------------------- | :----------------------------------------------------------------------------------------------------------------
`docker-compose up --build app`          | Run the application in the foreground (this is what `npm run compose` does).
`docker-compose up --build --detach app` | Run the application in the background.
`docker-compose stop`                    | Stop all containers.
`docker-compose down`                    | Stop and remove all containers (but keep the data).
`docker-compose down --volumes`          | Stop and permanently delete all containers and data.
`docker-compose exec app <command>`      | Execute a command inside the running `app` container (e.g. `docker-compose exec app npm install my-new-package`).
`docker-compose ps`                      | List running containers.

> Running the application with `docker-compose up` will also automatically
> re-generate the API documentation and re-run the linter on code changes.

## Develop locally

You will need:

* A [PostgreSQL](https://www.postgresql.org) 13+ server with the
  [PostGIS](https://postgis.net) extension.
* [Node.js](https://nodejs.org) 12.x.
* [Python](https://www.python.org) 3+ and the
  [pip](https://pypi.org/project/pip/) package installer.

### Setup

* Install Node.js dependencies:
  * Run `npm ci` on a fresh clone.
  * Or, run `npm install` to install new dependencies.
* Intall required Python tools:

  ```bash
  pip3 install opencv-python numpy scipy pymap3d
  ```
* Install the submodule
  ```
  git submodule update --init --recursive
  ```
* Create an empty database:

  ```bash
  psql
  > CREATE DATABASE smapshot;
  ```

* If you are using PostGIS 3+, you must also manually create the postgis and postgis_raster extensions before migrating the database:

  ```
  \connect smapshot
  CREATE EXTENSION postgis;
  CREATE EXTENSION postgis_raster;
  ```

* Migrate the database (assuming you have the correct database configuration in
  your `.env` file):

  ```bash
  npm run migrate
  ```


### Run the application

* Run `npm start` to start the server once.
* Or, run `npm run dev` to start it with live reload. It will also keep the API
  documentation up to date and lint the code when it changes.

Then visit http://localhost:1337.

### Run the automated tests

Create a separate test database, called `smapshot-test` by default. You can
override the test database settings (e.g. `DB_NAME`, `DB_HOST`) in a `.env.test`
file similar to your `.env` file.

Command                 | Description
:---------------------- | :-------------------------------------------------------------------------
`npm test`              | Run the test suite.
`npm run test:coverage` | Also generate a test coverage report (slower) in the `coverage` directory.
`npm run test:debug`    | Run the test suite with verbose logs to help debug issues.
`npm run test:watch`    | Automatically run the tests when code changes.

## Development guide

Read [the development guide](./DEVELOPMENT.md) for more information.
