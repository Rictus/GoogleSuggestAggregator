var fs = require('fs');


module.exports = function (configurationFilePath) {
    var conf = require(configurationFilePath);
    var allowedChars = conf["allowedChars"].split('');
    var generatedDataDirectoryPath = conf["generatedDataDirectoryPath"];
    return {
        generateCombinationsFromFile: function (fileToRead, fileToProduce, onDone) {
            var lineReader = require('readline').createInterface({
                input: fs.createReadStream(fileToRead)
            });
            var outputFileWriteStream = fs.createWriteStream(fileToProduce, {
                flags: 'a+',
                defaultEncoding: 'utf8'
            });

            lineReader.on('line', function (line) {
                var strToWrite = "";
                for (var i = 0; i < allowedChars.length; i++) {
                    strToWrite += line + allowedChars[i] + "\n";
                }
                outputFileWriteStream.write(strToWrite, function (err) {
                    if (err) throw err;
                });
            });
            lineReader.on('close', function () {
                lineReader.input.close();
                onDone();
            });
        },
        launch: function (processusDone) {
            var writeNextFile = function (wordLength, maxWordLength, cb) {
                var inputFile, outputFile, outputFilename;
                outputFilename = "data_length_" + wordLength;
                inputFile = generatedDataDirectoryPath + "/data_length_" + (wordLength - 1);
                outputFile = generatedDataDirectoryPath + "/" + outputFilename;

                conf["generatedFiles"].push(outputFile);
                var getDateTime = function () {
                    var date = new Date();
                    var day = date.getDate();
                    var month = date.getMonth() + 1;
                    var year = date.getFullYear();
                    var minutes = date.getMinutes();
                    var hour = date.getHours();
                    var seconds = date.getSeconds();
                    return day + "/" + month + "/" + year + " " + hour + ":" + minutes + ":" + seconds;
                };
                var startGeneration = function (err) {
                    if (err)throw err;
                    console.log(getDateTime() + " : Starting generation");
                    console.time("Generated file '" + outputFilename + "'");
                    that.generateCombinationsFromFile(inputFile, outputFile, onGenerationTerminated);
                };

                var onGenerationTerminated = function () {
                    console.timeEnd("Generated file '" + outputFilename + "'");
                    console.log(getDateTime() + " : Generation of words of length " + wordLength + " completed.");
                    console.log("");
                    wordLength++;
                    if (wordLength <= maxWordLength) {
                        writeNextFile(wordLength, maxWordLength, cb);
                    } else {
                        if (typeof cb !== "function") {
                            console.error("Callback not provided.");
                        } else {
                            cb();
                        }
                    }
                };

                fs.stat(outputFile, function (err, stat) {
                    if (err == null) {
                        fs.unlink(outputFile, function () {
                            startGeneration();
                        });
                    } else if (err.code == 'ENOENT') {
                        // File does not exist. So that's ok
                        startGeneration();
                    } else {
                        throw err;
                    }
                });
            };
            var writeFirstFile = function (doneCb) {
                for (var i = 0; i < allowedChars.length; i++) {
                    // Need to write synchronously to keep order
                    fs.appendFileSync(firstFile, allowedChars[i] + "\n");
                }
                conf["generatedFiles"].push(firstFile);
                if (conf["maxWordLength"] > 1) {
                    writeNextFile(2, conf["maxWordLength"], doneCb);
                }
            };
            var onDirectoryExist = function () {
                fs.stat(firstFile, function (err, stat) {
                    if (err == null) {
                        fs.unlink(firstFile, function () {
                            writeFirstFile(processusDone);
                        })
                    } else if (err.code == 'ENOENT') {
                        // File does not exist. So that's ok
                        writeFirstFile(processusDone);
                    } else {
                        throw err;
                    }
                });
            };

            var that = this;
            conf["generatedFiles"] = [];
            var firstFile = generatedDataDirectoryPath + "/data_length_1";

            fs.stat(generatedDataDirectoryPath, function (err, stat) {

                if (err == null) {
                    console.log("Directory " + generatedDataDirectoryPath + " exist.");
                    onDirectoryExist();
                } else {
                    fs.mkdir(generatedDataDirectoryPath, function (err) {
                        if (err) {
                            console.error("Can't create the directory '" + generatedDataDirectoryPath + "'");
                        } else {
                            console.log("Directory " + generatedDataDirectoryPath + " created.");
                            onDirectoryExist();
                        }
                    });
                }
            });
        }
    }
};

