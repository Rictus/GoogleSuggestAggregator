var queriedDataDirectoryPath = "queried/";
var request = require('request');
var syncRequest = require('sync-request');
var readline = require('readline');
var fs = require('fs');
var path = require('path');
var conf = require('./../conf.json');

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
            console.log("Adding " + line);
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

    getFiles: function (cb) {
        var dirPAth = "./generations/";
        var output = [];
        fs.readdir(dirPAth, function (err, files) {
            if (err) {
                throw err;
            }

            files.map(function (file) {
                return path.join(dirPAth, file);
            }).filter(function (file) {
                return fs.statSync(file).isFile();
            }).forEach(function (file) {
                output.push(file);
            });
            cb(output);
        });
    },

    launchAsync: function () {
        var that = this;
        this.getFiles(function (files) {

            (function loop(files, idx) {
                var f = files[idx];
                var of = queriedDataDirectoryPath + "queried_" + path.basename(f);
                that.l(f, queriedDataDirectoryPath + "/queried_data_" + (idx + 1), function () {
                    idx++;
                    if (idx < files.length) {
                        loop(files, idx);
                    }
                });
            })(files, 0);
        });
    },
    launchSync: function () {
        var that = this;
        this.getFiles(function (files) {
            for (var idx = 0; idx < files.length; idx++) {
                var f = files[idx];
                var of = queriedDataDirectoryPath + "queried_" + path.basename(f);
                that.processSync(f, queriedDataDirectoryPath + "/queried_data_" + (idx + 1));
            }
        });
    },
    writeSuggestionToFileSync: function (word, suggestions, filepath) {
        fs.appendFileSync(filepath, word + ">" + suggestions);
    },
    l: function (inputFile, outputFile, cb) {
        var that = this;
        var MAX_NB_SOCKETS = 15;
        var CURRENT_NB_SOCKETS = 0;
        var queueLines = [];
        console.log("Synchronously querying from file " + inputFile + " ...");
        var LineByLineReader = require('line-by-line');
        var lr = new LineByLineReader(inputFile);

        lr.on('error', function (err) {
            // 'err' contains error object
            throw err;
        });

        lr.on('line', function (line) {
            // 'line' contains the current line without the trailing newline character.
            onLineRead(line);
        });

        lr.on('end', function () {
            // All lines are read, file is closed now.
            console.log("close.");
            cb();
        });

        var state = function (f) {
            console.log(CURRENT_NB_SOCKETS + "/" + MAX_NB_SOCKETS + "  Q=" + queueLines.length + " from : " + f);
        };

        var onLineRead = function (line) {
            // Launch synchronous function to get suggestion
            if (MAX_NB_SOCKETS == CURRENT_NB_SOCKETS) {
                // Can't send the current query, need to wait for another query to resolve
                queueLines.push(line);
                lr.pause();
                state("Block Reader " + line);
            } else {
                // Can send it
                state("Socket Send " + line);
                CURRENT_NB_SOCKETS++;
                that.sendQuery(line, 'en', function (body, error, url) {
                    CURRENT_NB_SOCKETS--;
                    that.writeSuggestionToFileSync(line, body, outputFile);
                    state("Socket resolve " + line);
                    // Check the queue
                    if (queueLines.length > 0) {
                        onLineRead(queueLines.pop());
                    } else {
                        // Read the next line
                        state("Resume Reader ");
                        lr.resume();
                    }
                });
            }
        };
    }
};