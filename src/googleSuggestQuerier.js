var fs = require('fs');
var path = require('path');
var LineByLineReader = require('line-by-line');
var googleSuggest = require('./googleSuggest.js');

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
        suggestionFilename: function (lengthOfWords) {
            return "queried_length_" + lengthOfWords;
        },
        createDataDirectorySync: function () {
            try {
                fs.statSync(queriedDataDirectoryPath);
            } catch (e) {
                fs.mkdirSync(queriedDataDirectoryPath);
            }
        },
        createMissingSuggestionFilesSync: function () {
            var that = this;
            var loop = function (currentLength) {
                var filename = that.suggestionFilename(currentLength);
                var filePath = queriedDataDirectoryPath + "/" + filename;
                try {
                    fs.statSync(filePath); //The file exist
                } catch (e) {
                    // The file doesn't exist
                    fs.closeSync(fs.openSync(filePath, 'w'));
                }
            };
            for (var i = 1; i < maxWordLength; i++) {
                loop(i);
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
         * Search for suggestion files.
         * Give an object describing state of each file (path, lastKeyword, if it is done).
         * If a file doesn't exist, it is created
         * @param cb Function(Array of objects)
         * example of object :
         * { file: 'queried\\queried_length_1',
             lastKeyword: 'c',
             lastLine: 'c > cdiscount,,convertisseur youtube,carrefour,castorama,camaieu,calendrier 2017,cultura',
             isComplete: false,
             wordLength: 1 }
         */
        getSuggestionFilesStates: function (cb) {
            var filesState = [];
            var that = this;
            _files.createMissingSuggestionFilesSync();
            _files.getSuggestionFiles(function (files) {
                var loopFile = function (idxFile) {
                    var file = files[idxFile];
                    var lengthOfWordsInFile = file.split("_");
                    lengthOfWordsInFile = parseInt(lengthOfWordsInFile[lengthOfWordsInFile.length - 1]);
                    var isComplete = false;

                    _files.getLastLine(file, function (lastLine) {
                        var expectedEndOfFileKeyword = conf.allowedChars[conf.allowedChars.length - 1].repeat(lengthOfWordsInFile);
                        if (lastLine.indexOf(expectedEndOfFileKeyword) == 0) {
                            // This file is complete
                            isComplete = true;
                        } else {
                            isComplete = false;
                            var lastKeyword = that.suggestionLineGetKeyword(lastLine);
                            lastKeyword = lastKeyword === false ? "" : lastKeyword;
                            filesState.push({
                                file: file,
                                lastKeyword: lastKeyword,
                                lastLine: lastLine,
                                isComplete: isComplete,
                                wordLength: lengthOfWordsInFile
                            });
                        }
                        if (idxFile + 1 < files.length) {
                            loopFile(idxFile + 1);
                        } else {
                            cb(filesState);
                        }
                    });
                };
                if (files.length > 0)
                    loopFile(0);
                else
                    cb(filesState)
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
        sync: function (suggestionFile, cb) {
            var lastKeyword = suggestionFile.lastKeyword;
            var outputFile = suggestionFile.file;
            var wordLength = suggestionFile.wordLength;
            var suggestions;
            var keywordProvider = require('./keywordGenerator.js');
            var onKeyword = function (keyword) {
                suggestions = googleSuggest.getSuggestionsSync(keyword);
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
            keywordProvider.init(lastKeyword, wordLength);
            if (lastKeyword.length > 0) {
                // Ths suggestion for this keyword are already written in the fie
                keywordProvider.next();
            }
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
                var of = queriedDataDirectoryPath + "/" + _files.suggestionFilename(currentLength);
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
        resume: function (cb) {
            _files.createDataDirectorySync();

            var onSuggestionFilesReady = function (suggestionFiles) {
                var loop = function (suggFileIdx) {
                    var currentSuggestionFile = suggestionFiles[suggFileIdx];
                    console.log("Building " + currentSuggestionFile.file + " with length of " + currentSuggestionFile.wordLength);
                    _processSimpler.sync(currentSuggestionFile, function () {
                        if (suggFileIdx + 1 < suggestionFiles.length) {
                            loop(suggFileIdx + 1);
                        }
                    });
                };
                if (suggestionFiles.length > 0)
                    loop(0);

            };

            _files.getSuggestionFilesStates(onSuggestionFilesReady);
        }
    };
};