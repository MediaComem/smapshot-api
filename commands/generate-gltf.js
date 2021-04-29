const gltf = require("../app/api/gltf/gltf.controller");

const imageIds = ['1'] //['2775', '2783', '2776', '2843']
for (let i = 0; i < imageIds.length; i++){
  gltf.generateFromDbPromise(imageIds[i])
    .then(() => console.log('Gltf '+imageIds[i]+' is created'))
    .catch(() => console.log('Gltf '+imageIds[i]+' failed'))
}
