"use strict";
var request = require('request');
var syncRequest = require('sync-request');

var _request = {
    build_url: function (query, language) {
        if (typeof language !== "string" || language.length == 0) {
            language = "en";
        }
        return "http://suggestqueries.google.com/complete/search?client=firefox&q=" + query + "&hl=" + language;
    },
    sync: function (query, language) {
        var url = this.build_url(query, language);
        try {
            var res = syncRequest('GET', url);
            switch (res.statusCode) {
                case 403:
                    return false;
                    break;
                case 200:
                    return res.getBody().toString();
                    break;
                default:
                    _log.errorRequest(url, query, "Don't know how to handle status code " + res.statusCode);
                    break;
            }
        } catch (e) {
            var nbMsWait = 1000 * 30;
            console.error("Lost connection. Trying in " + nbMsWait + " milliseconds.");
            setTimeout(function () {
                return this.sync(query, language);
            }, nbMsWait);
        }
    },
    async: function (query, language, callback) { //TODO Check connectivity
        var url = this.build_url(query, language);
        request(url, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                callback(body, url);
            }
            else {
                callback(false, url);
            }
        });
    }
};

var _gSuggest = {
    normalizeBodySuggestionResponse: function (body) {
        try {
            body = typeof body === "string" ? JSON.parse(body) : body;
            if (typeof body === "object" && typeof body.length === "number" && body.length > 0) {
                body = body[1];
            } else if (typeof body !== "boolean") {
                body = [];
            }
            return body;
        } catch (e) {
            console.error("---error---");
            console.error(body);
            console.error(e);
            console.error("------");
        }
    },
    getSuggestionsAsync: function (word, cb) {
        var that = this;
        _request.async(word, 'fr', function (body) {
            cb(that.normalizeBodySuggestionResponse(body));
        });
    },
    getSuggestionsSync: function (word) {
        var body = _request.sync(word, 'fr');
        return this.normalizeBodySuggestionResponse(body);
    }
};

module.exports = _gSuggest;