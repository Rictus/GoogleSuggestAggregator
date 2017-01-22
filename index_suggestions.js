var googleSuggestQuerier = require('./src/googleSuggestQuerier.js')(__dirname + "/conf.json");
console.log(new Date());

console.time("googleSuggestQuerier");
googleSuggestQuerier.resume(1, function () {
    console.timeEnd("googleSuggestQuerier");
});

