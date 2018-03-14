'use strict';

const fs = require('fs');
const path = require('path');
const isWsl = require('is-wsl');
const filterObj = require('filter-obj');
const camelcase = require('camelcase');
const camelcaseKeys = require('camelcase-keys');
const loadEnvFile = require('./lib/load-env-file');

const num = fs.constants;
const permissionMask = 0o777;
const windowsPermission = 0o555;
const ownerReadWrite = num.S_IRUSR | num.S_IWUSR;

const checkMode = (filepath, mask) => {
    const status = fs.statSync(filepath);
    if (!status.isFile()) {
        throw new Error(`Filepath must be a file: ${filepath}`);
    }
    return status.mode & mask;
};

const assertHidden = (filepath) => {
    const filename = path.basename(filepath);
    if (!filename.startsWith('.')) {
        throw new Error(`Filepath must be hidden, use ".${filename}" instead of "${filename}"`);
    }
};

const isWindows = () => {
    return isWsl || process.platform === 'win32';
};

const envy = (input) => {
    const envPath = input || '.env';
    const examplePath = envPath + '.example';

    assertHidden(envPath);

    if (checkMode(examplePath, num.S_IWOTH) === num.S_IWOTH) {
        throw new Error(`File must not be writable by others. Fix: chmod o-w '${examplePath}'`);
    }
    const exampleEnv = loadEnvFile(examplePath);
    const exampleEnvKeys = Object.keys(exampleEnv);
    const camelizedExampleEnvKeys = Object.keys(camelcaseKeys(exampleEnv));

    if (exampleEnvKeys.length < 1) {
        throw new Error(`At least one entry is required in ${examplePath}`);
    }
    const exampleHasValues = Object.values(exampleEnv).some((val) => {
        return val !== '';
    });
    if (exampleHasValues) {
        throw new Error(`No values are allowed in ${examplePath}, put them in ${envPath} instead`);
    }

    const camelizedGlobalEnv = camelcaseKeys(process.env);
    const camelizedGlobalEnvKeys = Object.keys(camelizedGlobalEnv);

    // We treat env vars as case insensitive, like Windows does.
    const needsEnvFile = camelizedExampleEnvKeys.some((key) => {
        return !camelizedGlobalEnvKeys.includes(key);
    });

    if (!needsEnvFile) {
        return filterObj(camelizedGlobalEnv, camelizedExampleEnvKeys);
    }

    if (isWindows() && checkMode(envPath, permissionMask) !== windowsPermission) {
        throw new Error(`File permissions are unsafe. Make them 666 '${envPath}'`);
    }
    else if (!isWindows() && checkMode(envPath, permissionMask) !== ownerReadWrite) {
        throw new Error(`File permissions are unsafe. Fix: chmod 600 '${envPath}'`);
    }

    const camelizedLocalEnv = camelcaseKeys(loadEnvFile(envPath));

    const camelizedMergedEnv = Object.assign({}, camelizedLocalEnv, camelizedGlobalEnv);
    const camelizedMergedEnvKeys = Object.keys(camelizedMergedEnv);

    const camelizedMissingKeys = camelizedExampleEnvKeys.filter((key) => {
        return !camelizedMergedEnv[key] || !camelizedMergedEnvKeys.includes(key);
    });
    if (camelizedMissingKeys.length > 0) {
        const missingKeys = camelizedMissingKeys.map((camelizedMissingKey) => {
            return exampleEnvKeys.find((exampleKey) => {
                return camelcase(exampleKey) === camelizedMissingKey;
            });
        });
        throw new Error(`Environment variables are missing: ${missingKeys.join(', ')}`);
    }

    const keepKeys = Array.from(new Set([...Object.keys(camelizedLocalEnv), ...camelizedExampleEnvKeys]));
    return filterObj(camelizedMergedEnv, keepKeys);
};

module.exports = envy;
