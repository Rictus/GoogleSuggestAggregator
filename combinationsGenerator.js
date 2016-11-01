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
    launch: function () {
        var that = this;
        conf.generatedFiles = [];
        var firstFile = generatedDataDirectoryPath + "data_length_1";
        fs.stat(firstFile, function (err, stat) {
            if (err == null) {
                fs.unlink(firstFile, function () {
                    firstFileReady();
                })
            } else if (err.code == 'ENOENT') {
                // File does not exist. So that's ok
                firstFileReady();
            } else {
                throw err;
            }
        });

        var firstFileReady = function () {
            for (var i = 0; i < allowedChars.length; i++) {
                fs.appendFile(firstFile, allowedChars[i] + "\n", function (err) {
                    if (err) throw err;
                });
            }
            conf.generatedFiles.push(firstFile);

            (function loop(idx, maxIdx) {
                var inputFile, outputFile;
                inputFile = generatedDataDirectoryPath + "data_length_" + (idx - 1);
                outputFile = generatedDataDirectoryPath + "data_length_" + idx;
                conf.generatedFiles.push(outputFile);
                var onFileDeleted = function (err) {
                    if (err)throw err;
                    console.time("Generating file '" + outputFile + "'");
                    that.generateCombinationsFromFile(inputFile, outputFile, onGenerationTerminated);
                };

                var onGenerationTerminated = function () {
                    console.timeEnd("Generating file '" + outputFile + "'");
                    idx++;
                    if (idx <= maxIdx) {
                        loop(idx, maxIdx);
                    }
                };

                fs.stat(outputFile, function (err, stat) {
                    if (err == null) {
                        fs.unlink(outputFile, function () {
                            onFileDeleted();
                        })
                    } else if (err.code == 'ENOENT') {
                        // File does not exist. So that's ok
                        onFileDeleted();
                    } else {
                        throw err;
                    }
                });
            })(2, conf.maxWordLength);
        };
    }
};