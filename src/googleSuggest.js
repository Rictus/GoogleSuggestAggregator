"use strict";
var request = require('request');
var iconv = require('iconv-lite');
var _request = {
    build_url: function (query, language) {
        if (typeof language !== "string" || language.length == 0) {
            language = "en";
        }
        return "http://suggestqueries.google.com/complete/search?client=firefox&q=" + query + "&hl=" + language;
    },
    handleRequestError: function (query, language, requestCallback, error, response) {
        if (error) {
            var time = 0;
            switch (error.code) {
                case "ECONNRESET":
                    console.warn("Connexion reset. Retrying in 5s ...");
                    time = 5 * 1000;
                    break;
                case "ETIMEDOUT":
                    requestCallback(false);
                    break;
                default:
                    console.error("Don't know how to handle error code : " + error.code + ". Retrying in 3 sec ...");
                    time = 3 * 1000;
                    break;
            }
            setTimeout(function () {
                _request.async(query, language, requestCallback);
            }, time);
        } else {
		requestCallback(false);
/*
            switch (response.statusCode) {
                case 403:
                    requestCallback(false, url);
                    break;
                default:
                    console.error("Don't know how to handle status code : " + response.statusCode);
                    break;
            }
//*/
        }
    },
    async: function (query, language, callback) {
        var url = this.build_url(query, language);
        var requestOptions = {encoding: null, method: "GET", uri: url};
        request(requestOptions, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                var utf8String = iconv.decode(new Buffer(body), "ISO-8859-1");
                callback(utf8String, url);
            }
            else {
                _request.handleRequestError();
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
    }
};
/*
 _gSuggest.getSuggestionsAsync("etei", function (suggestions) {
 console.log(suggestions);
 });
 //*/
module.exports = _gSuggest;
