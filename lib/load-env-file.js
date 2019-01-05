'use strict';

const fs = require('fs');

const loadEnvFile = (filepath) => {
    const content = fs.readFileSync(filepath, 'utf8');
    return content.trim().split(/\r?\n/u).reduce((result, elem) => {
        const line = elem.trim();
        if (!line || line.startsWith('#')) {
            return result;
        }
        const splitIndex = line.indexOf('=');
        const key = line.substring(0, splitIndex);
        const val = line.substring(splitIndex + 1);
        if (!key) {
            throw new Error(`Missing key for environment variable in ${filepath}`);
        }
        result[key] = (val.startsWith('\'') && val.endsWith('\'')) ? val.slice(1, -1) : val;
        return result;
    }, {});
};

module.exports = loadEnvFile;
