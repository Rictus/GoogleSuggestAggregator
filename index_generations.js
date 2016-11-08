var combinationsGenerator = require('./src/combinationsGenerator.js');

console.time("combinationsGenerator : ");
combinationsGenerator.launch(function () {
    console.timeEnd("combinationsGenerator : ");
});