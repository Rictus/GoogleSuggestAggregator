var queriedDataDirectoryPath = __dirname + "/queried/";
var request = require('request');
var syncRequest = require('sync-request');
var readline = require('readline');
var fs = require('fs');
var conf = require('./conf.json');

/**
 * Read a set of data file and query google suggest
 */
module.exports = {

    build_url: function (query, language) {
        if (typeof language !== "string" || language.length == 0) {
            language = "en";
        }
        return "http://suggestqueries.google.com/complete/search?client=firefox&q=" + query + "&hl=" + language;
    },

    sendQuery: function (query, language, callback) {
        var url = this.build_url(query, language);
        request(url, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                callback(body, false, url);
            }
            else {
                callback(body, error, url);
            }
        });
    },

    sendQuerySync: function (query, language) {
        var url = this.build_url(query, language);
        var res = syncRequest('GET', url);
        return res.getBody();
    },

    processSync: function (inputFile, outputFile) {
        var that = this;
        console.log("Synchronously querying from file " + inputFile + " ...");
        var fd = fs.openSync(inputFile, 'r');
        var bufferSize = 1024;
        var buffer = new Buffer(bufferSize);

        var leftOver = '';
        var read, line, idxStart, idx;
        while ((read = fs.readSync(fd, buffer, 0, bufferSize, null)) !== 0) {
            leftOver += buffer.toString('utf8', 0, read);
            idxStart = 0;
            while ((idx = leftOver.indexOf("\n", idxStart)) !== -1) {
                line = leftOver.substring(idxStart, idx);
                that.onLineRead(line, outputFile);
                idxStart = idx + 1;
            }
            leftOver = leftOver.substring(idxStart);
        }
    },

    onLineRead: function (line, outputFile) {
        var that = this;
        var body = this.sendQuerySync(line, 'fr');
        try {
            body = JSON.parse(body);
            if (typeof body === "object" && typeof body.length === "number" && body.length > 0) {
                body = JSON.stringify(body[1]);
            } else {
                body = "[]";
            }
            fs.appendFileSync(outputFile, line + " > " + body + "\n");
        } catch (e) {
            console.error("------");
            console.error("Error for line '" + line + "' : ");
            console.error(body);
            console.error(e);
            console.error("------");
        }
    },

    process: function (inputFile, outputFile) {
        console.log("Querying from file " + inputFile + " ...");
        var that = this;
        var lineReader = readline.createInterface({
            input: fs.createReadStream(inputFile)
        });

        lineReader.on('line', function (line) {
            that.sendQuery(line, 'fr', function (body, err, url) {
                try {
                    body = JSON.parse(body);
                    if (body.isArray()) {
                        body = JSON.stringify(body[1]);
                    } else {
                        body = "[]";
                    }
                    fs.appendFileSync(outputFile, line + " > " + body + "\n");
                } catch (e) {
                    console.error("------");
                    console.error("Error for line '" + line + "' : " + url);
                    console.error(body);
                    console.error(err);
                    console.error("------");
                }
            });
        });
    },

    launch: function () {
        for (var i = 0; i < conf.generatedFiles.length; i++) {
            this.processSync(conf.generatedFiles[i], queriedDataDirectoryPath + "/queried_data_" + (i + 1));
        }
    }
};