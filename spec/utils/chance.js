const { Chance } = require('chance');

const { seed } = require('../config');

let actualSeed;
if (seed !== undefined) {
  actualSeed = seed;
  console.log(`Using seed ${seed} from environment`);
} else {
  actualSeed = Math.floor(Math.random() * Math.floor(1000 * 1000));
  console.log(`Using random seed ${actualSeed}`);
}

// https://chancejs.com
exports.chance = new Chance(actualSeed);
