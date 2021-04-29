const { constant, get, has, isFunction, isPlainObject, isUndefined, mapValues, omitBy } = require('lodash');

/**
 * Returns the specified object without any undefined values.
 *
 *     const object = { foo: 'bar', baz: undefined };
 *     compactObject(object); // { foo: 'bar' }
 *
 * @param {Object} object - The object to compact.
 * @returns A new object.
 */
exports.compactObject = object => omitBy(object, isUndefined);

/**
 * Generates random items with a custom function.
 *
 *     const createPerson = ({ first, last }) => `${first} ${last}`;
 *     const person = await createPerson({ first: 'John', last: 'Doe' });
 *     console.log(person);  // "John Doe"
 *
 *     const people = await generate(3, createPerson, i => ({ first: 'John', last: i }));
 *     console.log(people);  // [ "John 1", "John 2", "John 3" ]
 *
 * @param {number} n - The number of items to generate.
 * @param {Function} generator - A function that generates one item. It may be
 * asynchronous.
 * @param {(Object|Function)} [options] - Options for the generator. This may
 * also be a function which receives the zero-based index of the item and
 * returns the options.
 * @returns {Promise} A promise that will be resolved with an array of the
 * generated items.
 */
exports.generate = (n, generator, options = {}) => {
  const optionsFactory = isFunction(options) ? options : constant(options);
  return Promise.all(Array(n).fill().map((_, i) => generator(optionsFactory(i))));
};

/**
 * Returns the value of an object's property, or a default value if the property
 * is missing.
 *
 *     const properties = { foo: 'bar' };
 *     get(properties, 'foo', 'default');  // 'bar'
 *     get(properties, 'baz', 'default');  // 'default'
 */
exports.get = get;

/**
 * Returns the value of an object's property, or generate a random value if the
 * property is missing.
 *
 *     const properties = { foo: 'bar' };
 *     getOrGenerate(properties, 'foo', 'default');            // 'bar'
 *     getOrGenerate(properties, 'baz', () => Math.random());  // 0.34587
 *
 * @param {Map.<string, *>} properties - The properties.
 * @param {string} key - The name of the property to retrieve.
 * @param {Function} generator - A function to generate a value if the property
 * is missing.
 */
exports.getOrGenerate = (properties, key, generator) => {
  if (!isFunction(generator)) {
    throw new Error(`Generator must be a function, but its type is ${typeof generator}`);
  }

  return has(properties, key) ? properties[key] : generator();
};

/**
 * Convenience function to automatically generate an associated fixture.
 *
 * For example, imagine that you are generating a new random Collection, and you
 * want to also generate a random Owner for it. You can call this function with
 * the data for your Collection and an Owner-generating function. If the
 * Collection contains no Owner information, one will be automatically generated
 * and returned along with its ID:
 *
 *     const collectionOptions = { name: "My collection", is_owner_challenge: true };
 *     const { owner, owner_id } = getOrGenerateAssociation(collectionOptions, createOwner, "owner");
 *     console.log(owner_id);    // 42
 *     console.log(owner.slug);  // "random"
 *
 *     // Continue generating random data for the Collection...
 *
 * If you already have an Owner ID, this function will do nothing:
 *
 *     const collectionOptions = { name: "My collection", is_owner_challenge: true, owner_id: 12 };
 *     const { owner, owner_id } = getOrGenerateAssociation(collectionOptions, createOwner, "owner");
 *     console.log(owner_id);  // 12
 *     console.log(owner);     // undefined
 *
 * Similarly, if you already have an Owner object that has an ID, this function
 * will also do nothing:
 *
 *     const existingOwner = { id: 12, slug: "foo", description: "bar" };
 *     const collectionOptions = { name: "My collection", is_owner_challenge: true, owner: existingOwner };
 *     const { owner, owner_id } = getOrGenerateAssociation(collectionOptions, createOwner, "owner");
 *     console.log(owner_id);                 // 12
 *     console.log(owner === existingOwner);  // true
 *
 * If you want a random Owner to be generated but still want to customize some
 * of its properties, you can do so by providing an Owner object which does not
 * have an ID. It will be used as options to the provided generator function
 * (i.e. "createOwner" in this example):
 *
 *     const ownerOptions = { slug: "custom" };
 *     const collectionOptions = { name: "My collection", is_owner_challenge: true, owner: ownerOptions };
 *     const { owner, owner_id } = getOrGenerateAssociation(collectionOptions, createOwner, "owner");
 *     console.log(owner_id);                 // 24
 *     console.log(owner === ownerOptions);   // false
 *     console.log(owner.slug);               // "custom"
 *     console.log(owner.description);        // "random"
 *
 * Note that the third argument to this function defines the name of the
 * association (e.g. "owner") when it is a simple string. But you can also
 * customize the behavior of this function by passing an options object.
 *
 * @param {Object.<string,*>} properties - The properties of the fixture being
 * generated. They may contain either the ID of the associated fixture, an
 * existing associated fixture object, or options to generate it.
 * @param {Function} generator - An asynchronous function that can generate the
 * associated fixture.
 * @param {string|Object} [associationOrOptions] - Options to customize the
 * generation of the associated fixture. If this is a simple string, it is used
 * as the `association` option.
 * @param {string} [associationOrOptions.association] - The name of the
 * association (e.g. "owner" or "user"). With the `_id` suffix, it will
 * determine the key of `properties` expected to contain the ID of the
 * associated fixture (e.g. "owner_id" or "user_id"). This is also the key of
 * `properties` that can be used to pass options to the generator function.
 * @param {number} [associationOrOptions.defaultId] - The default ID to use for
 * the associated fixture if none is provided in `properties`, either as an ID
 * (e.g. "user_id") or an already generated fixture (e.g. "user").
 * @param {boolean} [associationOrOptions.required=true] - Whether the
 * associated fixture is required to exist. If true (the default), it will
 * automatically be generated when not provided. If false and no ID or
 * associated fixture object is provided, then it will simply not be generated.
 * @returns {Promise} A promise which will be resolved with the associated
 * fixture ID. The associated fixture object will also be provided if one was
 * generated.
 */
exports.getOrGenerateAssociation = async (properties, generator, associationOrOptions = {}) => {

  // If the options are a simple string, use it as the association name and
  // leave all other options undefined.
  let options = associationOrOptions;
  if (typeof associationOrOptions === 'string') {
    options = { association: associationOrOptions };
  }

  // Retrieve the association name and column name, e.g. "user" & "user_id".
  const associationName = options.association;
  const associationColumn = `${associationName}_id`;

  // Check that the association is not provided as both an ID (e.g. "user_id")
  // and an object (e.g. "user"). It must be one or the other, or it must not be
  // provided at all.
  const associatedObjectOptions = properties[associationName];
  const associationIdOption = properties[associationColumn];
  if (associatedObjectOptions !== undefined && associationIdOption !== undefined) {
    throw new Error(`Options "${associationName}" and "${associationColumn}" are mutually exclusive`);
  }

  // If the association is not required and neither an ID or an object were
  // provided, then the association need not be generated.
  const required = get(options, 'required', true);
  if (!required && associatedObjectOptions === undefined && associationIdOption === undefined) {
    return {
      [associationName]: undefined,
      [associationColumn]: null
    };
  }

  // Determine the effective associated object and ID. The ID is determined in
  // this way:
  //
  // * Either it is provided directly as an option (e.g. "user_id").
  // * Or it is passed within the provided associated object (e.g. the "id"
  //   property of the provided "user").
  // * Or it takes the value of the "defaultId" option if provided.
  // * Or it defaults to null.
  let associatedObject = associatedObjectOptions;
  let associatedObjectId = associationIdOption || get(associatedObjectOptions, 'id') || options.defaultId || null;

  // If the ID is null, then the associated object is generated with the
  // provided generator. If options were provided, they are passed to the
  // generator.
  if (!associatedObjectId) {
    associatedObject = await generator(associatedObjectOptions === true ? {} : associatedObjectOptions || {});
    associatedObjectId = associatedObject.id;
  }

  // Return the associated object and ID (e.g. "user" and "user_id") which were
  // either passed or automatically generated.
  return {
    [associationName]: associatedObject,
    [associationColumn]: associatedObjectId
  };
};

/**
 * Serializes column values for insertion into the database.
 *
 * @param {Map.<string, *>} columns - The values to insert.
 * @returns {Map.<string, *>} The serialized values.
 */
exports.serialize = columns => mapValues(columns, value => {
  if (isPlainObject(value)) {
    // If the value is a plain object, assume that the column is of type `json`.
    return JSON.stringify(value);
  }

  return value;
});

/**
 * Takes a function that generates random values and returns an equivalent
 * function that never returns the same value twice.
 *
 * The generator function is passed the index of the current generation, which
 * can be used to produce the value to ensure that it is never the same (e.g.
 * "john-1", "bob-2", "alice-3", "john-4", etc).
 *
 * Simple equality is used to check if the value has already been generated, so
 * this should only be used for primitive values (e.g. numbers, strings).
 *
 * @param {Function} generator - A function that generates random values.
 * @returns {Function} A version of the function that never produces the same
 * value twice.
 */
exports.uniqueGenerator = generator => {
  const generatedValues = [];
  return () => {

    for (let i = 0; i < 100; i++) {
      const generatedValue = generator(generatedValues.length);
      if (!generatedValues.includes(generatedValue)) {
        generatedValues.push(generatedValue);
        return generatedValue;
      }
    }

    throw new Error('Could not generate a unique value after 100 attempts');
  };
};
