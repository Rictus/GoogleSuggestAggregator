var fs = require('fs');
var conf = require('./conf.json');
var generatedDataDirectoryPath = __dirname + "/generations/";

allowedChars = conf.allowedChars.split('');

module.exports = {

    /**
     * Generate all possibles permutations of given length with given letters
     * @param letters
     */
    generatePermutations: function (letters) {
        if (typeof letters === "string") {
            letters = letters.split('');
        } else if (letters.isArray()) {
            // it's ok
        } else {
            return false;
        }
        var wordLength = letters.length;
        var output = [];
        for (var i = 0; i < letters.length; i++) {
            var nbStep = 0;
            var idx = i;
            while (nbStep < letters.length) {
                output.push(letters[i] + letters[idx]);
                idx = (idx + 1) % letters.length;
                nbStep++;
            }
        }
        return output;
    },
    generateCombinations: function (length, got, pos, letters, outputFilename) {
        if (got === false) {
            got = [];
        }
        if (pos === false) {
            pos = 0;
        }
        var cnt = 0;
        if (got.length == length) {
            fs.appendFileSync(outputFilename, got.join('') + "\n");
            return 1;
        }
        var idx = pos;
        do {
            got.push(letters[idx]);
            cnt += generateCombinations(length, got, idx, letters, outputFilename);
            got.pop();
            idx = (idx + 1) % letters.length;
        } while (idx != pos);

        return cnt;
    },
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
        var writeNextFile = function (idx, maxIdx, cb) {
            var inputFile, outputFile, outputFilename;
            outputFilename = "data_length_" + idx;
            inputFile = generatedDataDirectoryPath + "data_length_" + (idx - 1);
            outputFile = generatedDataDirectoryPath + outputFilename;

            conf.generatedFiles.push(outputFile);
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
                console.log(getDateTime() + " : Generation terminated.");
                console.log("");
                idx++;
                if (idx <= maxIdx) {
                    writeNextFile(idx, maxIdx, cb);
                } else {
                    cb();
                }
            };

            fs.stat(outputFile, function (err, stat) {
                if (err == null) {
                    fs.unlink(outputFile, function () {
                        startGeneration();
                    })
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
            conf.generatedFiles.push(firstFile);
            if (conf.maxWordLength > 1) {
                writeNextFile(2, conf.maxWordLength);
            }
        };

        var that = this;
        conf.generatedFiles = [];
        var firstFile = generatedDataDirectoryPath + "data_length_1";
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
    }
};