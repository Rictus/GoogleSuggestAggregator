var googleSuggestQuerier = require('./src/googleSuggestQuerier.js')(__dirname + "/conf.json");

console.time("googleSuggestQuerier");
googleSuggestQuerier.sync(function () {
    console.timeEnd("googleSuggestQuerier");
});