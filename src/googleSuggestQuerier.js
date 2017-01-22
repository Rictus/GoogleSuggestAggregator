var request = require('request');
var syncRequest = require('sync-request');
var fs = require('fs');
var path = require('path');
var LineByLineReader = require('line-by-line');
var keywordProvider = require('./keywordGenerator.js');

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
        getFilesOfDir: function (dirPath, cb) {
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
        getQueriesFiles: function (cb) {
            var dirPath = conf["queriedDataDirectoryPath"];
            this.getFilesOfDir(dirPath, cb);
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
        },
        getLastLine: function (filePath, cb) {
            var lastLine = "";
            this.readFileAsync(filePath, function (line) {
                lastLine = line;
            }, function () {
                cb(lastLine);
            });
        }
    };
    var _processSimpler = {
        sync: function (wordLength, outputFile, cb) {
            var suggestions;
            var onKeyword = function (keyword) {
                suggestions = _gSuggest.getSuggestionsSync(keyword);
                if (suggestions === false) {
                    // Blocked by google. Need to wait
                    var nbMsWait = 1000 * 60 * 7 + 1000; // 7 minutes & 1 sec
                    _log.GoogleReject(keyword, nbMsWait);
                    setTimeout(function () {
                        onKeyword(keyword)
                    }, nbMsWait);
                } else {
                    _files.writeSuggestionSync(keyword, suggestions, outputFile);
                }
            };
            keywordProvider.initLength(wordLength);
            var keyword = keywordProvider.get();
            while (keyword.length == wordLength) {
                onKeyword(keyword);
                keyword = keywordProvider.next();
            }
            cb();
        }
    };

    return {
        launch: function (startLength, cb) {
            _files.createDataDirectorySync();
            var maxLength = conf.maxWordLength;
            var loop = function (currentLength) {
                var of = queriedDataDirectoryPath + "/queried_length_" + currentLength;
                _files.deleteFileIfExistSync(of);
                _processSimpler.sync(currentLength, of, function () {
                    if (currentLength + 1 < maxLength)
                        loop(currentLength + 1);
                    else
                        cb();
                });
            };
            loop(startLength);
        },
        resume: function () {
            _files.createDataDirectorySync();
            var maxLength = conf.maxWordLength;
            // Get last lines of files and complete missing ones..
            _files.getQueriesFiles(function (files) {
                var loopFile = function (idxFile) {
                    var file = files[idxFile];
                    var lengthOfWordsInFile = file.split("_");
                    lengthOfWordsInFile = lengthOfWordsInFile[lengthOfWordsInFile.length - 1];
                    lengthOfWordsInFile = parseInt(lengthOfWordsInFile);
                    if (lengthOfWordsInFile > maxLength) {
                        //DONE
                    } else {
                        _files.getLastLine(file, function (lastLine) {
                            console.log(file + " => " + lastLine);
                            var expectedEndOfFileKeyword = conf.allowedChars[conf.allowedChars.length - 1].repeat(lengthOfWordsInFile);
                            if (lastLine.indexOf(expectedEndOfFileKeyword) == 0) {
                                // This file is done
                            } else {
                                console.log("The file " + file + " is not done. Last line is :\n" + lastLine);
                            }
                        });

                        if (idxFile + 1 < files.length)
                            loopFile(idxFile + 1);
                    }
                };
                loopFile(0);
            });
        }
    };
};