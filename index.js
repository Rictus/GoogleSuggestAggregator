var combinationsGenerator = require('./combinationsGenerator.js');
var googleSuggestQuerier = require('./googleSuggestQuerier.js');
var conf = require('./conf.json');


console.time("combinationsGenerator : ");
combinationsGenerator.launch(function () {
    console.timeEnd("combinationsGenerator : ");
});


//overwriting to avoid relaunch of combinationsGenerator
//conf.generatedFiles = ["./generations/data_length_1", "./generations/data_length_2"];

/*
console.time("googleSuggestQuerier : ");
googleSuggestQuerier.launch();
console.timeEnd("googleSuggestQuerier : ");
*/