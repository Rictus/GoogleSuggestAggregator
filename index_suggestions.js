var googleSuggestQuerier = require('./src/googleSuggestQuerier.js');

console.time("googleSuggestQuerier");
googleSuggestQuerier.launchSync();
console.timeEnd("googleSuggestQuerier");
