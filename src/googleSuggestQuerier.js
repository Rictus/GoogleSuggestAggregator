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
var maxWordLength = conf["maxWordLength"];
    var _log = {
        fileWrite: function (word, suggestions, file) {
            //console.log("[" + word + "] Writing suggestions to " + file + ". Suggestions : " + suggestions);
        },
        errorRequest: function (url, query, explain) {
            console.error("[" + query + "] (" + url + ") : " + explain);
        },
        error: function (message) {
            console.error(message);
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
        getSuggestionFiles: function (cb) {
            var dirPath = conf["queriedDataDirectoryPath"];
            this.getFilesOfDir(dirPath, cb);
        },
        /**
         * Search for incomplete suggestion files.
         * An incomplete suggestion file is a file where the last line is not the expected keyword
         * e.g. : With allowed chars is a to z, last keyword should be zzz for length 3.
         * @param cb Array of Objects like { file: filePath, lengthOfWords, theLength, lastKeyword: keywordOfLastLine}
         */
        getIncompleteSuggestionFiles: function (cb) {
            var incompleteFiles = [];
            var that = this;
            _files.getSuggestionFiles(function (files) {
                var loopFile = function (idxFile) {
                    var file = files[idxFile];
                    var lengthOfWordsInFile = file.split("_");
                    lengthOfWordsInFile = lengthOfWordsInFile[lengthOfWordsInFile.length - 1];
                    lengthOfWordsInFile = parseInt(lengthOfWordsInFile);
                    if (lengthOfWordsInFile <= maxWordLength){
                        _files.getLastLine(file, function (lastLine) {
                            var expectedEndOfFileKeyword = conf.allowedChars[conf.allowedChars.length - 1].repeat(lengthOfWordsInFile);
                            if (lastLine.indexOf(expectedEndOfFileKeyword) == 0) {
                                // This file is complete

                            } else {
                                var lastKeyword = that.suggestionLineGetKeyword(lastLine);
                                if (lastKeyword === false) {
                                    _log.error("Fail to get keyword of this suggestion line " + lastLine);
                                }
                                incompleteFiles.push({
                                    lengthOfWords: lengthOfWordsInFile,
                                    file: file,
                                    lastKeyword: lastKeyword
                                });
                            }
                            if (idxFile + 1 < files.length) {
                                loopFile(idxFile + 1);
                            } else {
                                cb(incompleteFiles);
                            }
                        });
                    } else {
                        cb(incompleteFiles);
                    }
                };
                loopFile(0);
            });
        },
        suggestionLineGetKeyword: function (line) {
            // create a regex to capture keyword at beginning of line
            var regexSearch = "(^[" + conf.allowedChars + "]+) > .*$";
            var m = line.match(regexSearch);
            return m && m.length > 0 ? m[1] : false;
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
            var maxLength = maxWordLength;
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
            var maxLength = maxWordLength;
            _files.getIncompleteSuggestionFiles(function (d) {
                console.log(d);
            })
        }
    };
};