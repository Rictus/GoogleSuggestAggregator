var request = require('request');
var syncRequest = require('sync-request');
var fs = require('fs');
var path = require('path');
var LineByLineReader = require('line-by-line');


/**
 * Read a set of data file and query google suggest
 */
module.exports = function (confFilePath) {
    var conf = require(confFilePath);

    var queriedDataDirectoryPath = conf["queriedDataDirectoryPath"];

    var _log = {
        fileWrite: function (word, suggestions, file) {
            console.log("[" + word + "] Writing suggestions to " + file + ". Suggestions : " + suggestions);
        },
        errorRequest: function (url, query, explain) {
            console.error("[" + query + "] (" + url + ") : " + explain);
        },
        AsyncReaderState: function (state, queueLength, currentNumberOfSockets) {
            console.log("Reader " + state + ". " + queueLength + " elements in queue. " + currentNumberOfSockets + " sockets.");
        },
        AsyncSocketState: function (word, state) {
            console.log("[" + word + "] Socket " + state);
        },
        GoogleReject: function (word, waitingTime) {
            console.log("[" + word + "] Google is blocking our requests. Waiting " + waitingTime + " milliseconds.");
        }
    };

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

    var _files = {
        wordSuggestionSeparator: " > ",
        createDataDirectorySync: function () {
            try {
                fs.statSync(queriedDataDirectoryPath);
            } catch (e) {
                fs.mkdirSync(queriedDataDirectoryPath);
            }
        },
        deleteFileIfExistSync: function (filePath) {
            try {
                fs.statSync(filePath);
                fs.unlinkSync(filePath);
            }
            catch (e) {
                // It's ok, the file doesn't exist.
            }
        },
        deleteFileIfExistAsync: function (filePath, cb) {
            fs.stat(filePath, function (err) {
                if (err) {
                    // It's ok the file doesn't exist.
                    cb();
                } else {
                    fs.unlink(filePath, function () {
                        cb();
                    });
                }
            });
        },
        getStringToWrite: function (word, suggestions) {
            return word + this.wordSuggestionSeparator + suggestions + "\n";
        },
        writeSuggestionSync: function (word, suggestions, file) {
            _log.fileWrite(word, suggestions, file);
            fs.appendFileSync(file, this.getStringToWrite(word, suggestions));
        },
        writeSuggestionAsync: function (word, suggestions, file, cb) {
            _log.fileWrite(word, suggestions, file);
            fs.appendFile(file, this.getStringToWrite(word, suggestions), function (err) {
                if (err) throw err;
                cb();
            });
        },
        /**
         * Files generated by combinationsGenerator.js
         * @param cb
         */
        getCombinationFiles: function (cb) {
            var dirPath = conf["generatedDataDirectoryPath"];
            var output = [];
            fs.readdir(dirPath, function (err, files) {
                if (err) {
                    throw err;
                }

                files.map(function (file) {
                    return path.join(dirPath, file);
                }).filter(function (file) {
                    return fs.statSync(file).isFile();
                }).forEach(function (file) {
                    output.push(file);
                });
                cb(output);
            });
        },
        readLineSync: function (filePath, actionOnEachLine) {
            var fd = fs.openSync(filePath, 'r');
            var bufferSize = 1024;
            var buffer = new Buffer(bufferSize);

            var leftOver = '';
            var read, line, idxStart, idx;
            while ((read = fs.readSync(fd, buffer, 0, bufferSize, null)) !== 0) {
                leftOver += buffer.toString('utf8', 0, read);
                idxStart = 0;
                while ((idx = leftOver.indexOf("\n", idxStart)) !== -1) {
                    line = leftOver.substring(idxStart, idx);
                    actionOnEachLine(line);
                    idxStart = idx + 1;
                }
                leftOver = leftOver.substring(idxStart);
            }
        },
        readFileAsync: function (filePath, actionOnEachLine, actionOnClose) {
            var lr = new LineByLineReader(filePath);
            lr.on('error', function (err) {
                throw err;
            });

            lr.on('line', function (line) {
                actionOnEachLine(line);
            });

            lr.on('end', function () {
                actionOnClose();
            });
            return lr;
        },
        getQueriedWords: function (filePath, cb) {
            var that = this;
            var queriedWords = [];//WIP
            var lr = this.readFileAsync(filePath, function (line) {
                queriedWords.push(line.split(that.wordSuggestionSeparator)[0]);
            }, function () {
                cb(queriedWords);
            });
        }
    };

    var _process = {
        sync: function (inputFile, outputFile, cb) {
            var suggestions;

            var onLineRead = function (line) {
                suggestions = _gSuggest.getSuggestionsSync(line);
                if (suggestions === false) {
                    // Blocked by google. Need to wait
                    var nbMsWait = 1000 * 60 * 15;
                    _log.GoogleReject(line, nbMsWait);
                    lineReader.pause();
                    setTimeout(function () {
                        onLineRead(line)
                    }, nbMsWait);
                } else {
                    lineReader.resume();
                    _files.writeSuggestionSync(line, suggestions, outputFile);
                }
            };
            // Need to use an async file reader because we need to stop file reader when google block requests
            var lineReader = _files.readFileAsync(inputFile, function (line) {
                onLineRead(line);
            }, function () {
                cb();
            });

        },
        async: function (inputFile, outputFile, cb) {
            var MAX_NB_SOCKETS = 15;
            var CURRENT_NB_SOCKETS = 0;
            var queueLines = [];

            var lineReader = _files.readFileAsync(inputFile, function (line) {
                onLineRead(line);
            }, function () {
                _log.AsyncReaderState("Close", queueLines.length, CURRENT_NB_SOCKETS);
                cb();
            });

            var onLineRead = function (line) {
                if (MAX_NB_SOCKETS == CURRENT_NB_SOCKETS) {
                    // Can't send the current query. Otherwise, the maximum number of
                    // sockets will be reached. Need to wait for other queries to be resolve.
                    queueLines.push(line);
                    lineReader.pause();
                    _log.AsyncReaderState("Pause", queueLines.length, CURRENT_NB_SOCKETS);
                } else {
                    CURRENT_NB_SOCKETS++;
                    _log.AsyncSocketState(line, "Send");
                    _gSuggest.getSuggestionsAsync(line, function (suggestions) {
                        onSuggestions(line, suggestions)
                    });
                }
            };

            var onSuggestions = function (word, suggestions) {
                CURRENT_NB_SOCKETS--;
                _log.AsyncSocketState(word, "Resolve");
                if (suggestions === false) {
                    // Blocked by google. Need to wait
                    var nbMsWait = 1000 * 60 * 15;
                    lineReader.pause();
                    console.log("[" + word + "] Google is blocking our requests. Let's wait " + nbMsWait + " milliseconds.");
                    setTimeout(function () {
                        onLineRead(word)
                    }, nbMsWait);
                } else {
                    _files.writeSuggestionAsync(word, suggestions, outputFile, function () {
                        // Check the queue
                        if (queueLines.length > 0) {
                            onLineRead(queueLines.pop());
                        } else {
                            // Read the next line
                            _log.AsyncReaderState("Resume", queueLines.length, CURRENT_NB_SOCKETS);
                            lineReader.resume();
                        }
                    });
                }
            };
        }
    };

    return {
        launchSync: function () {
            _files.createDataDirectorySync();
            _files.getCombinationFiles(function (files) {
                var loop = function (files, idx) {
                    var f = files[idx];
                    var of = queriedDataDirectoryPath + "/queried_" + path.basename(f);
                    _files.deleteFileIfExistSync(of);
                    _process.sync(f, of, function () {
                        idx++;
                        if (idx < files.length) {
                            loop(files, idx);
                        }
                    });
                };
                if (files.length > 0) {
                    loop(files, 0);
                }
            });
        },
        launchAsync: function () {
            _files.createDataDirectorySync();
            _files.getCombinationFiles(function (files) {
                var loop = function (files, idx) {
                    var f = files[idx];
                    var of = queriedDataDirectoryPath + "/queried_" + path.basename(f);
                    _files.deleteFileIfExistAsync(of, function () {
                        _process.async(f, of, function () {
                            idx++;
                            if (idx < files.length) {
                                loop(files, idx);
                            }
                        });
                    });
                };
                if (files.length > 0) {
                    loop(files, 0);
                }
            });
        },
        resumeAsync: function () {
            _files.createDataDirectorySync();
            _files.getCombinationFiles(function (files) {
                var loop = function (files, idx) {
                    var f = files[idx];
                    var of = queriedDataDirectoryPath + "/queried_" + path.basename(f);
                    //TODO
                    // Need to know which words have been queried
                    _files.getQueriedWords(f, function (words) {

                    });
                    // If the number of queried words is equal to a *magic formula* for the current length, the file is complete.
                    // Otherwise, let's query missing ones
                };
                if (files.length > 0) {
                    loop(files, 0);
                }
            });
        }
    };
};