var googleSuggestQuerier = require('./src/googleSuggestQuerier.js')(__dirname + "/conf.json");

console.log(new Date());

console.time("googleSuggestQuerier");

googleSuggestQuerier.async(function () {
    console.timeEnd("googleSuggestQuerier");
});
//*/
/*
 googleSuggestQuerier.sync();
 console.timeEnd("googleSuggestQuerier");
 //*/

