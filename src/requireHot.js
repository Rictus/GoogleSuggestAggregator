/**
 * requireHot() is the same as require() but each time you call it it will effectively reload the file
 * i.e. : This module avoid using any cache
 * @param moduleName
 * @returns {*}
 */
var requireHot = function (moduleName) {

    var purgeCache = function (moduleName) {
        // Traverse the cache looking for the files
        // loaded by the specified module name
        searchCache(moduleName, function (mod) {
            delete require.cache[mod.id];
        });

        // Remove cached paths to the module.
        // Thanks to @bentael for pointing this out.
        Object.keys(module.constructor._pathCache).forEach(function (cacheKey) {
            if (cacheKey.indexOf(moduleName) > 0) {
                delete module.constructor._pathCache[cacheKey];
            }
        });
    };

    /**
     * Traverses the cache to search for all the cached
     * files of the specified module name
     */
    var searchCache = function (moduleName, callback) {
        // Resolve the module identified by the specified name
        var mod = require.resolve(moduleName);

        // Check if the module has been resolved and found within
        // the cache
        if (mod && ((mod = require.cache[mod]) !== undefined)) {
            // Recursively go over the results
            (function traverse(mod) {
                // Go over each of the module's children and
                // traverse them
                mod.children.forEach(function (child) {
                    traverse(child);
                });

                // Call the specified callback providing the
                // found cached module
                callback(mod);
            }(mod));
        }
    };

    purgeCache(moduleName);
    return require(moduleName);
};
module.exports = function (moduleName) {
    return requireHot(moduleName);
};