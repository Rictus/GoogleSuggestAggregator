var googleSuggestQuerier = require('./src/googleSuggestQuerier.js')(__dirname + "/conf.json");

console.log(new Date());

console.time("googleSuggestQuerier");

googleSuggestQuerier.launchSync(function () {
    console.timeEnd("googleSuggestQuerier");
});
//*/
/*
 googleSuggestQuerier.launchSync();
 console.timeEnd("googleSuggestQuerier");
 //*/

