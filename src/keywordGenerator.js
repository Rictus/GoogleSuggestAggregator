"use strict";
var conf = require('./../conf.json');

String.prototype.replaceAt = function (index, character) {
    return this.substr(0, index) + character + this.substr(index + character.length);
};


var keywordProvider = {
    current: "",
    init: function (startString) {
        this.current = startString.length > 0 ? startString : conf.allowedChars[0];
    },
    initLength: function (length) {
        this.current = conf.allowedChars[0].repeat(length);
    },
    get: function () {
        return this.current;
    },
    next: function () {
        var that = this;
        /**
         * Increment the character of the given idx
         * @param idx
         */
        var incrementChar = function (idx) {
            var charAt = that.current.charAt(idx);
            var indexInAllowedChars = conf.allowedChars.indexOf(charAt);
            if (charAt === "") {
                return conf.allowedChars[0];
            }
            if (indexInAllowedChars == conf.allowedChars.length - 1) {
                // Last character : Go back to zero and increment left character
                that.current = that.current.replaceAt(idx, conf.allowedChars[0]);
                if (that.current.charAt(idx - 1).length == 0) {
                    // No left character, just create one
                    that.current = conf.allowedChars[0] + that.current;
                } else {
                    // Left char present, increment it
                    incrementChar(idx - 1);
                }
            }
            else {
                that.current = that.current.replaceAt(idx, conf.allowedChars[indexInAllowedChars + 1]);
            }
        };
        incrementChar(this.current.length - 1);
        return this.current;
    },
    display: function () {
        console.log("(" + this.current.length + ") " + this.current);
    }
};


module.exports = keywordProvider;