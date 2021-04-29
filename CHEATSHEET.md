# Cheatsheet

Tips for day-to-day development.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [API routes](#api-routes)
- [Database migrations](#database-migrations)
- [Testing](#testing)
    - [All tests](#all-tests)
    - [Retrieval tests](#retrieval-tests)
    - [Creation and update tests](#creation-and-update-tests)
    - [Deletion tests](#deletion-tests)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## API routes

When implementing or updating an API route, your workflow should be:

1. Make sure to **write the OpenAPI documentation** for the route (or update it).
1. **Write the tests** for the route (or update them). See [testing
  tips](#testing) below.
1. **Implement the route**:
  * If you need **new configuration from the environment**, it should be
    retrieved in `config/index.js`. You should not use `process.env` anywhere
    else.

    Also add your new variables to the `.env.sample` file.
  * If you need to make changes to the database, **write a database migration**.
    See the relevant section in the [development
    guide](./DEVELOPMENT.md#database-migrations) and in [this
    document](#database-migrations).
  * **Add appropriate logs**, or update existing logs if necessary. See
    [Logging](./DEVELOPMENT.md#logging).

When refactoring a legacy route, also mind the following practices. This should
be done after the documentation and tests have been written.

* Errors should generally not be handled in the controllers but passed to
  Express so that they end up in the **global error handler**.

  * If the client needs additional information about the error other than a
    simple message, use an instance of `HttpProblemDetailsError` so that the
    response is in our standard error format. If this type of error occurs in
    multiple places, add a convenience function to create such an error. See
    `app/utils/errors.js` for examples.
* If the implementation is a large function, attempt to **split it into simpler,
  easier-to-understand and easier-to-test functions**.
* If the implementation contains Node.js-style callbacks, **refactor to use
  promises**. If a callback is required, isolate it into a function that simply
  converts the call into a promise.
* If the route is **not RESTful**, make a note of suggested changes in
  `TODO.md`.
* When implementing test data fixtures, make a note in `TODO.md` of **database
  schema improvements** that could be made, or constraints that could be added
  (e.g. missing foreign keys or columns that are nullable but should not be).
* If the route does not perform **proper authorization**, make a note of
  suggested security improvements in `TODO.md`.

## Database migrations

When writing a new migration:

* If you have added or removed a table, you may need to **update the lists of
  database tables** in `spec/utils/db.js`, as well as the `resetDatabase`
  function.
* If you have added or removed a column, you may need to **update the relevant
  test fixtures** in `spec/fixtures`.

## Testing

In general:

* **Mock any external service** with costly or undesirable side-effects, such as
  sending emails. This will speed up the test suite; the faster it is, the less
  you will hesitate to run it. It will also avoid mistakenly sending emails to
  actual people. The `createApplicationWithMocks` function is meant to create
  an instance of the application with all external services mocked for testing.

When writing an API route test:

* **Verify the entire HTTP response body and any custom headers**, not just one
  or two JSON properties. This ensures that the behavior of the API does not
  unexpectedly change in the future. The `jsonBody`, `httpProblemDetailsBody`
  and `validationErrors` assertions have been implemented for this purpose.
* **Verify that the API implementation and the OpenAPI documentation are in
  sync** by using the `matchRequestDocumentation` assertion on the request you
  are sending, and the `matchResponseDocumentation` assertion on the response
  you receive.
* **Wipe all data in the test database** using the asynchronous `resetDatabase`
  function before any test which depends on the database, and insert any data
  fixtures you might need before running the actual test. This ensures that
  tests always start with a specific, reproducible state, and that they do not
  interfere with each other.
* **Verify that no unexpected side effects have occurred** by using the
  `expectSideEffects` and `expectNoSideEffects` functions. This may help detect
  unwanted side effects when making changes in the future, such as unexpected
  database changes.

  Note that these functions do not account for every change that could have
  occurred. They can currently detect:

  * Changes in the number of rows in the application's main database tables.

    A row that is inserted and then deleted will not be detected as a change.
    Updates are not detected either.
  * Mails that are sent using the application's mail service.

  Additional checks for side effects may need to be performed in complex tests.
* **Verify that the correct data is in the database after an insertion, update
  or deletion** when testing a route which modifies the database. Even if the
  API returns the correct response, it does not prove that the database was
  actually modified or that it was modified correctly. Common database checks
  (e.g. whether a specific user is in the database) may be encapsulated into
  convenience functions in the `spec/expectations` directory.

### All tests

* If the route requires authentication, write a test which ensures that **public
  access is denied**.
* If the route has authorization, write a test which ensures that **unauthorized
  access is denied**.

### Retrieval tests

For tests on `GET` routes that simply retrieve information:

* Write a **base test** that inserts data fixtures and retrieves them.
* Write tests for **collection filters**. If time permits, there should be one
  test per filter, and one test using a combination of filters (if applicable).
* For routes that retrieve a single resource, write a test to ensure that a
  **404 Not Found** response is returned if an unknown resource is requested.
* For routes that retrieve a collection, write a test to **retrieve the empty
  list** without any data in the collection, to ensure that the system is
  functional in its initial state.

### Creation and update tests

For tests on `PATCH`, `POST` and `PUT` routes:

* Write a **base test** which checks that the route works with a minimal request
  (with all optional properties omitted).
* Write a test which checks that the route works **with all optional
  properties** included (if any).
* Write one test which triggers various **validation errors**. Additional tests
  might be warranted if there are complex validations.
* Write one test for **each unicity constraint** to ensure that they work.
* If the route uses external services, write a test to check **what happens when
  the service fails**.

### Deletion tests

For tests on `DELETE` routes:

* Write a **base test** which checks that the entity is no longer present in the
  database once it has been deleted.
* Write a test to ensure that a **404 Not Found** response is returned if an
  unknown resource is deleted.
