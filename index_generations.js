var combinationsGenerator = require('./src/combinationsGenerator.js')(__dirname + "/conf.json");

console.time("combinationsGenerator : ");
combinationsGenerator.launch(function () {
    console.timeEnd("combinationsGenerator : ");
});
