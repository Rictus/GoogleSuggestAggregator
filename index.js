var combinationsGenerator = require('./combinationsGenerator.js');
var googleSuggestQuerier = require('./googleSuggestQuerier.js');
var conf = require('./conf.json');

//combinationsGenerator.launch();
conf.generatedFiles = ["./generations/data_length_1", "./generations/data_length_2"]; //overwriting to avoid relaunch of combinationsGenerator
console.time("t");
googleSuggestQuerier.launch();
console.timeEnd("t");