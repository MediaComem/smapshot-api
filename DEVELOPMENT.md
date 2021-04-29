# Development guide

See the [CHEATSHEET](./CHEATSHEET.md) for day-to-day development.

For detailed information about the implementation of this application, read this
guide:

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Configuration](#configuration)
    - [Dotenv](#dotenv)
- [File structure](#file-structure)
- [Linting](#linting)
- [Database migrations](#database-migrations)
- [Logging](#logging)
- [Automated tests](#automated-tests)
    - [Test environment](#test-environment)
    - [Random seed](#random-seed)
    - [Custom assertions](#custom-assertions)
        - [OpenAPI assertions](#openapi-assertions)
- [API documentation](#api-documentation)
    - [Custom `!include` YAML tag](#custom-include-yaml-tag)
        - [Including JSON schemas](#including-json-schemas)
    - [Custom `$$merge` JSON property](#custom-merge-json-property)
- [COLLADA2GLTF](#collada2gltf)
- [Sample data](#sample-data)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Configuration

This application can be configured through environment variables. You can find a
list of all available variables and examples in the `.env.sample` file.

In the code, all this configuration is centralized in the `config/index.js`
file. All environment variables should be retrieved there, and any code which
needs configuration should require this file to obtain it.

### Dotenv

The [dotenv](dotenv) library is used to load environment variables from a file
on application startup (when not in production).

Which files are loaded depends on the environment, as determined by the
`$NODE_ENV` environment variable. For example, for the `development` environment
(the default), the following files are loaded by dotenv if they exist:

* `.env.development` (highest precedence)
* `.env.development.defaults`
* `.env` (lowest precedence)

The first value found is used for a given variable. For example, if a variable
is defined in `.env.development`, it takes precedence over the same variable in
`.env.development.defaults` and `.env`. Note that if an environment variable is
already set in your environment, it will [not be overwritten](dotenv-overwrite).

## File structure

The main directories in this project are:

Directory           | Description
:------------------ | :---------------------------------------------------------------------------------------------------
`app`               | [Express.js][express] application.
`app/api`           | API routes, controllers and documentation.
`app/models`        | [Sequelize][sequelize] models.
`app/services`      | External services (e.g. mailing).
`app/utils`         | Utility functions used throughout the application.
`app/express.js`    | Factory function for the Express.js application and its middlewares.
`app/server.js`     | Function to start the application's HTTP server.
`bin/www`           | Executable that starts the application.
`collada2gltf`      | The [COLLADA2GLTF](#COLLADA2GLTF) binary.
`commands`          | [Node.js][node] scripts meant to be run from the command line.
`config`            | Application configuration.
`coverage`          | Test coverage reports (only exists if you have run the tests with coverage enabled).
`docker`            | Files used by Docker or Docker Compose.
`locales`           | Translation files.
`spec`              | Utilities for automated tests (the tests themselves are in the `app` directory along with the code).
`spec/assertions`   | Custom [Chai][chai] assertions.
`spec/expectations` | More complex expectations usually composed of multiple assertions.
`spec/fixtures`     | Data population functions to set up the initial state of tests.
`spec/utils`        | Utility functions used throughout test code.
`spec/config.js`    | Test-related configuration.
`utils`             | Utilities shared by different types of code (e.g. scripts and tests).

You will find subdirectories under `app/api` which group together files related
to an API resource. They generally contain:

File(s)                 | Description
:---------------------- | :---------------------
`foo.routes.js`         | Express.js route definitions.
`foo.controller.js`     | Route implementations.
`foo.openapi.yml`       | OpenAPI documentation for these routes.
`schemas/*.schema.json` | Related JSON schemas.
`foo.*.spec.js`         | Automated tests for these routes.

In general, prefer the *`<what>.<type...>.js`* naming convention:

* `foo.controller.js`
* `foo.req.schema.js`

As opposed to:

* ~~`fooController.js`~~
* ~~`foo_Controller.js`~~
* ~~`foo_controller.js`~~

When a filename or part of it is composed of multiple words, prefer hyphenating:

* `foo.cool-thing.js`
* `lemon-chicken.schema.json`
* `awesome-stuff.js`

As opposed to:

* ~~`foo.coolThing.js`~~
* ~~`lemonChiken.schema.json`~~
* ~~`awesomeStuff.js`~~

## Linting

This project's code is linted with [ESLint][eslint]. You can find the linting
configuration in the `.eslintrc.json` file.

Linting is triggered automatically when developing with `npm run dev`, using the
`--fix` option to automatically fix simple problems. You can also trigger
linting manually with `npm run lint`.

## Database migrations

The evolution of the database is managed through [Sequelize
migrations][sequelize-migrations]. Migrations files are in the `db/migrations`
directory of this repository.

You can use the [Sequelize Command-Line Interface][sequelize-cli] to manage
migrations. Here's a few useful commands when developing with Docker Compose:

Command                                                                    | Description
:------------------------------------------------------------------------- | :---------------------------------
`npm run compose:sequelize-cli -- db:migrate`                              | Run pending migrations.
`npm run compose:migrate`                                                  | *Alias for the previous command.*
`npm run compose:sequelize-cli -- db:migrate:status`                       | List the status of all migrations.
`npm run compose:sequelize-cli -- db:migrate:undo`                         | Reverts a migration.
`npm run compose:sequelize-cli -- db:migrate:undo:all`                     | Reverts all migrations ran.
`npm run compose:sequelize-cli -- migration:generate --name add-new-stuff` | Generates a new migration file.

When developing locally, you can use `sequelize-cli` directly using [npx][npx],
for example:

Command                               | Description
:------------------------------------ | :---------------------------------
`npx sequelize-cli db:migrate`        | Run pending migrations.
`npm run migrate`                     | *Alias for the previous command.*
`npx sequelize-cli db:migrate:status` | List the status of all migrations.

Migrations can be written in two ways:

* Using the Sequelize query interface to write migrations in JavaScript:
  * https://sequelize.org/master/manual/migrations.html#migration-skeleton
  * https://sequelize.readthedocs.io/en/latest/docs/migrations/#functions
* Using a raw SQL files and executing them from a Sequelize migration file. This
  way you can write raw SQL but still use the Sequelize CLI which keeps track of
  executed migrations.

  Look at the "initial-schema" migration in `db/migrations` for an example.

## Logging

This application uses the [winston][winston] library for logging. It is
configured in `config/logger.js`.

Note that our Express application creates a logger for each request which will
include a randomly generated request ID in log lines. In application code, you
should use the `getLogger` utility function from `app/utils/express.js` in order
to retrieve the correct logger:

```js
const { getLogger } = require('path/to/utils/express');

exports.someControllerFunction = function(req, res) {
  getLogger(req).info('Something cool happened');
  // ...
};
```

If you are not in the context of a request, you may import the main application
logger directly from `config/logger.js` instead:

```js
const logger = require('path/to/config/logger');

logger.info('Something cool happened');
```

You may log error objects, which will serialize their stack trace:

```js
try {
  // Do something dangerous.
} catch (err) {
  logger.error(err);
}
```

Logger methods such as `.info(msg)` and `.error(msg)` in the examples above
correspond to the available log levels which are, from most to least important:

* **`error`** - Unrecoverable errors which will cause the current request to
  fail or the application to crash. Note that "errors" which occur during normal
  operation, such as validation errors, should not use this log level.
* **`warn`** - Warnings about conditions that are not critical but are not
  expected to happen during normal operation and may warrant investigation.
  Again, validation errors should not use this log level.
* **`info`** - Information about important application lifecycle events that
  occurred, e.g. a new resource was created or an existing resource was updated.
  All controller functions which modify domain entities should have an
  information log.
* **`http`** - Used for automatic HTTP request logging. Should generally not be
  called in application code.
* **`verbose`** - Detailed or additional information normally not shown in the
  logs. "Errors" that occur during normal operations, such as validation errors,
  should use this log level.
* **`debug`** - Information intended to help debug issues, normally not shown in
  the logs.
* **`silly`** - Trace information, when `debug` is not detailed enough.

> You should generally use `info` (appears at the default log level) and
> `verbose` (does not appear at the default log level) in application code, or
> `warn` to indicate a condition that should not happen in normal operation.
>
> Use `debug` and `silly` for debugging complex code.
>
> API routes that simply retrieve information do not necessarily need to perform
> any logging.

## Automated tests

This project includes an automated test suite for its API, implemented with the
following libraries:

* [Mocha][mocha] to run the tests.
* [Chai][chai] to make assertions.
* [Sinon][sinon] to create spies, stubs and mocks.
* [Chance][change] to randomly generate data.
* [SuperTest][supertest] to test HTTP calls to the API.

If you are running the application with Docker Compose, you can run the test
suite with:

Command                         | Description
:------------------------------ | :-----------------------------------------
`npm run compose:test`          | Run tests.
`npm run compose:test:coverage` | Run tests with a coverage report (slower).
`npm run compose:test:debug`    | Run tests in debug mode (very verbose logs).

If you are running the application locally, you can use these commands instead:

Command                 | Description
:---------------------- | :---------------------------------------------------
`npm test`              | Run tests locally.
`npm run test:coverage` | Run tests locally with a coverage report (slower).
`npm run test:debug`    | Run tests in debug mode (very verbose logs).
`npm run test:watch`    | Automatically run tests every time a change is made.

The test coverage report is saved to `coverage/index.html`.

### Test environment

The test environment has custom settings defined in the `.env.test.defaults`
file (which is under version control). Since this file takes precedence over
your `.env` file, you can create a `.env.test` file if you need to override
these settings. This file will be local to your machine and not under
version control.

### Random seed

Mocha runs the tests in a deterministic order. However, this project's tests
use the [Chance][chance] library to generate random data. The library is seeded
with a random value which is printed to the console every time you run the test
suite:

```bash
$> npm test
Using random seed 290610
...
```

To reproduce an exact test run, including the same "random data", you may use
the `$SEED` environment variable:

```bash
$> SEED=290610 npm test
Using seed 290610 from environment
...
```

> This also works with the other test commands like `npm run compose:test`.

### Custom assertions

A number of custom assertions have been implemented and added to Chai to improve
the readability of this project's tests. You will find their implementation in
the `spec/assertions` directory.

#### OpenAPI assertions

This project includes assertions which can verify that:

* An HTTP request you are making is valid according to the OpenAPI
  documentation.

  ```js
  const req = {
    method: 'POST',
    url: '/auth/local/login',
    body: {
      email: 'john.doe@example.com',
      password: 'changeme'
    }
  };

  // Check that the POST /auth/local/login operation is documented. The content
  // type of the request body is checked. The documentation must also include a
  // JSON schema, and the body of the request must match that schema.
  expect(req).to.matchRequestDocumentation();
  ```
* An HTTP response you have received is valid according to the OpenAPI
  documentation.

  ```js
  const req = {
    method: 'POST',
    url: '/auth/local/login',
    body: {
      email: 'john.doe@example.com',
      password: 'changeme'
    }
  };

  const res = await testHttpRequest(app, req);

  // Check that the received response is one of the documented responses for the
  // POST /auth/local/login operation. The status code and content type are
  // checked. If the response has a body, the documentation of the response must
  // include a JSON schema and the response body must match that schema.
  expect(res).to.matchResponseDocumentation();
  ```

This serves as a kind of contract testing to make sure that the application and
its documentation are in sync.

> These assertions are implemented using a dereferenced version of this API's
> OpenAPI document, i.e. with all `$ref` pointers resolved. This dereferenced
> document is saved to `tmp/openapi.dereferenced.json` every time the tests are
> run, in case you need to check its contents to debug the assertions.

A few options are available to customize the documentation assertions:

* If you are knowingly making a request with an invalid body (e.g. to test
  validations), set the `invalidBody` option to true:

  ```js
  const req = {
    method: 'POST',
    url: '/auth/local/login',
    body: {
      // Invalid login data.
      email: 'foo',
      password: ''
    }
  };

  // Check that the POST /auth/local/login operation is documented, and that the
  // body of the request does NOT match the associated schema. (The assertion
  // will fail if the body is valid.)
  expect(req).to.matchRequestDocumentation({ invalidBody: true });
  ```

## API documentation

This application is a REST API which is documented according to the [OpenAPI
specification][openapi]. This documentation is served by the API using [Swagger
UI][swagger-ui]:

* When developing locally: http://localhost:1337/docs
* In production: *not available yet*

The base OpenAPI document is `app/api/openapi.yml`. This is not a full OpenAPI
document: it includes other documentation fragments under the `app/api`
directory, using a custom `!include` YAML tag and a custom `$$merge` JSON
property which are explained below.

The full OpenAPI document is compiled and saved to `app/generated/openapi.yml`.
This is done automatically when developing and testing through commands such as
`npm start`, `npm run dev` or `npm test`. In production, it must be done with
`npm run openapi` before starting the server.

A [dereferenced version of the OpenAPI
document](https://apitools.dev/swagger-parser/docs/swagger-parser.html#dereferenceapi-options-callback)
is also saved to `app/generated/openapi.dereferenced.yml` along with the
previous file. This version is used programmatically for schema validations.

Similarly, the application's various JSON schemas must be assembled and saved to
`app/generated/schemas.json`. This is also done automatically when developing
and testing. In production, it must be done with `npm run schemas` before
starting the server.

To precompile all the required files for production, you may use `npm run
precompile`. Note that this and the above commands requires the installation of
development dependencies (with `npm ci` or `npm install`), which can then be
removed with `npm prune --production`.

### Custom `!include` YAML tag

You may use the `!include FILE` tag in this project's OpenAPI document (or in
included YAML fragments):

```yml
---
foo: !include ./bar.yml
baz:
  - corge
  - !include ./**/*.grault.yml
```

It behaves as follows:

* If `FILE` is a path to a single file, relative to the file in which the
  include tag was found, then that file is loaded and its contents injected at
  that location. An absolute path may also be used.
* If `FILE` is a [glob pattern](https://www.npmjs.com/package/glob#glob-primer)
  which matches one or several files relative to where the include tag was
  found, those files are all loaded, merged together, and the resulting object
  or array is injected at that location.

  The matched files must either all represent a YAML sequence (array) or a YAML
  mapping (object). Sequences and objects cannot be mixed. The merge is shallow
  (sequences are simply concatenated, mappings are simply merged at the top
  level).

#### Including JSON schemas

You may also use the variant `!include jsonSchemasById FILE`, in this case,
files will be found as explained above, but their contents will be transformed.
For example, this schema:

```json
{
  "$id": "FooBar",
  "type": "string"
}
```

Will be transformed to:

```json
{
  "FooBar": {
    "$id": "FooBar",
    "type": "string"
  }
}
```

This is intended to allow merging multiple JSON schemas together into the
`/components/schemas` object of the OpenAPI document, each identified by its
`$id` property.

For example, if you have 3 JSON schemas like the one above, with `$id`
properties `Foo`, `Bar` and `Baz`, you would normally have to include them like
this:

```yml
components:
  schemas:
    Foo: !include ./foo.schema.json
    Bar: !include ./bar.schema.json
    Baz: !include ./baz.schema.json
```

This forces you to have duplication (the schema ID is both in the schema itself
and in the OpenAPI document), and is more verbose. Instead, you can include all
those schemas in one line like this:

```yml
components:
  schemas: !include jsonSchemasById ./**/*.schema.json
```

The assembled OpenAPI document will contain:

```yml
components:
  schemas:
    Foo:
      # Contents of the Foo schema
    Bar:
      # Contents of the Bar schema
    Baz:
      # Contents of the Baz schema
```

### Custom `$$merge` JSON property

You can merge content from other files into the JSON schemas referenced by this
project's OpenAPI document. If a JSON object contains a `$$merge` key:

```json
{
  "$$merge": {
    "file": "./other-file.json",
    "pointer": ""
  },
  "a": "value",
  "other": {
    "data": 42
  }
}
```

And assuming the `./other-file.json` file referenced in this example contains
the following JSON:

```json
{
  "a": "value (overriden)",
  "other": {
    "moreData": 24
  }
}
```

Then reading the original JSON file will produce:

```json
{
  "a": "value (overriden)",
  "other": {
    "data": 42,
    "moreData": 24
  }
}
```

The merge algorithm is the one provided by Lodash's `merge` function (see
https://lodash.com/docs/4.17.15#merge).

The "pointer" key is optional. If not specified, the whole JSON document
referenced by "file" is merged. If a pointer is specified, it must be a [JSON
pointer][json-pointer] to a subset of the JSON you want to merge. Whether
merging either a whole file or a subset, the merged value MUST be a JSON object,
not any other kind of JSON value.

The intended purpose of this feature is to merge properties from one JSON schema
into another to avoid duplication.

## COLLADA2GLTF

This application includes [COLLADA2GLTF][collada2gltf], a tool to convert
COLLADA files to the [glTF][gltf] format. Updating this tool is done manually:

* Download the release 'https://github.com/KhronosGroup/COLLADA2GLTF/releases'.
* Unzip it and put the binary in the `collada2gltf` directory.

## Sample data

Available to smapshot team members:

* [Switch drive - binary database
  dump](https://drive.switch.ch/index.php/apps/files/?dir=/Smapshot/Backup%20DB&fileid=1812262252)

  Restore a binary database dump when using Docker Compose:

  ```bash
  pg_restore -h localhost -U postgres -p 5434 -d smapshot smapshot.backup
  ```

  Restore an SQL or binary database dump locally:

  ```bash
  psql -h localhost -U postgres -d smapshot -f smapshot.sql
  pg_restore -h localhost -U postgres -d smapshot smapshot.backup
  ```
* [Switch drive - sample
  images](https://drive.switch.ch/index.php/apps/files/?dir=/Smapshot/Sample%20Data&fileid=1891746707).

  Unzip the contents of the `data.zip` file into the `public/data` directory in
  this repository.

[chai]: https://www.chaijs.com
[chance]: https://chancejs.com
[collada2gltf]: https://github.com/KhronosGroup/COLLADA2GLTF
[dotenv]: https://www.npmjs.com/package/dotenv
[dotenv-overwrite]: https://www.npmjs.com/package/dotenv#what-happens-to-environment-variables-that-were-already-set
[eslint]: https://eslint.org
[express]: https://expressjs.com
[gltf]: https://github.com/KhronosGroup/glTF
[json-pointer]: https://tools.ietf.org/html/rfc6901
[mocha]: https://mochajs.org
[node]: https://nodejs.org
[npx]: https://www.npmjs.com/package/npx
[openapi]: https://github.com/OAI/OpenAPI-Specification
[sequelize]: https://sequelize.org
[sequelize-cli]: https://github.com/sequelize/cli#readme
[sequelize-migrations]: https://sequelize.org/master/manual/migrations.html
[sinon]: https://sinonjs.org
[supertest]: https://www.npmjs.com/package/supertest
[swagger-ui]: https://swagger.io/tools/swagger-ui/
[winston]: https://github.com/winstonjs/winston#readme
