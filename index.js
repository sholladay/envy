'use strict';

const fs = require('fs');
const path = require('path');
const isWsl = require('is-wsl');
const pathType = require('path-type');
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
        throw new Error(`Filepath must be hidden. Fix: mv '${filename}' '.${filename}'`);
    }
};

const assertIgnored = (filepath) => {
    const basename = path.basename(filepath);
    const failMessage = `File must be ignored by git. Fix: echo '${basename}' >> .gitignore`;
    let ignores;
    try {
        ignores = fs.readFileSync(path.join(filepath, '..', '.gitignore'), 'utf8');
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            if (!pathType.dirSync(path.join(filepath, '..', '.git'))) {
                return;
            }
            throw new Error(failMessage);
        }
        throw error;
    }

    if (!ignores.split(/\r?\n/u).includes(path.basename(filepath))) {
        throw new Error(failMessage);
    }
};

const isWindows = () => {
    return isWsl || process.platform === 'win32';
};

const assertSafePermissions = (filepath) => {
    if (isWindows() && checkMode(filepath, permissionMask) !== windowsPermission) {
        throw new Error(`File permissions are unsafe. Make them 555 '${filepath}'`);
    }
    else if (!isWindows() && checkMode(filepath, permissionMask) !== ownerReadWrite) {
        throw new Error(`File permissions are unsafe. Fix: chmod 600 '${filepath}'`);
    }
};

const applyAllowedKeys = (obj, allowUnknownKeys, keepKeys) => {
    if (allowUnknownKeys === true) {
        return obj;
    }
    return filterObj(obj, [...allowUnknownKeys, ...keepKeys]);
};

const hasStringValues = (obj) => {
    return Object.values(obj).some((val) => {
        return val !== '';
    });
};

const normalizeOptions = (opts) => {
    const options = opts && typeof opts === 'object' ? opts : { filepath : opts };
    return {
        env          : options.env || process.env, // eslint-disable-line no-process-env
        filepath     : options.filepath || '.env',
        allowUnknown : options.allowUnknown || []
    };
};

const envy = (opts) => {
    const options = normalizeOptions(opts);
    const envPath = options.filepath;
    const examplePath = envPath + '.example';
    const camelizedAllowUnknownEnvKeys = Array.isArray(options.allowUnknown) ?
        options.allowUnknown.map(camelcase) :
        options.allowUnknown;

    assertHidden(envPath);

    if (checkMode(examplePath, num.S_IWOTH) === num.S_IWOTH) {
        throw new Error(`File must not be writable by others. Fix: chmod o-w '${examplePath}'`);
    }

    const exampleEnv = loadEnvFile(examplePath);
    const exampleEnvKeys = Object.keys(exampleEnv);
    const camelizedExampleEnvKeys = Object.keys(camelcaseKeys(exampleEnv));

    if (exampleEnvKeys.length === 0) {
        throw new Error(`At least one entry is required in ${examplePath}`);
    }
    if (hasStringValues(exampleEnv)) {
        throw new Error(`No values are allowed in ${examplePath}, put them in ${envPath} instead`);
    }

    const camelizedGlobalEnv = camelcaseKeys(options.env);
    const camelizedGlobalEnvKeys = Object.keys(camelizedGlobalEnv);

    // We treat env vars as case insensitive, like Windows does.
    const needsEnvFile = camelizedExampleEnvKeys.some((key) => {
        return !camelizedGlobalEnvKeys.includes(key);
    });

    if (!needsEnvFile) {
        return applyAllowedKeys(
            camelizedGlobalEnv,
            camelizedAllowUnknownEnvKeys,
            camelizedExampleEnvKeys
        );
    }

    assertSafePermissions(envPath);
    assertIgnored(envPath);

    const camelizedLocalEnv = camelcaseKeys(loadEnvFile(envPath));

    const camelizedMergedEnv = {
        ...camelizedLocalEnv,
        ...camelizedGlobalEnv
    };
    const camelizedMergedEnvKeys = Object.keys(camelizedMergedEnv);

    const camelizedMissingKeys = camelizedExampleEnvKeys.filter((key) => {
        return !camelizedMergedEnv[key] || !camelizedMergedEnvKeys.includes(key);
    });
    if (camelizedMissingKeys.length > 0) {
        const missingKeys = exampleEnvKeys.filter((exampleKey) => {
            return camelizedMissingKeys.includes(camelcase(exampleKey));
        });
        throw new Error(`Environment variables are missing: ${missingKeys.join(', ')}`);
    }

    return applyAllowedKeys(
        camelizedMergedEnv,
        camelizedAllowUnknownEnvKeys,
        [
            ...Object.keys(camelizedLocalEnv),
            ...camelizedExampleEnvKeys
        ]
    );
};

module.exports = envy;
