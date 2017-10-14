import path from 'path';
import test from 'ava';
import camelcase from 'camelcase';
import envy from '.';

const fixture = (dir, file = '.env') => {
    return envy(path.join('fixture', dir, file));
};

test('returns camelcased keys', (t) => {
    const env = fixture('normal');
    const keys = Object.keys(env);
    t.is(keys.length, 2);
    keys.forEach((key) => {
        t.is(key, camelcase(key));
    });
    t.deepEqual(env, {
        myKey : 'my val',
        dog   : 'woof'
    });
});

test('returns excess vars in .env', (t) => {
    t.deepEqual(fixture('excess-env-entry'), {
        myKey : 'my val',
        dog   : 'woof',
        extra : 'awesome'
    });
});

test('can parse complex values', (t) => {
    // Complex values are those which have a high risk of confusing the parser,
    // such as those using reserved characters.
    t.deepEqual(fixture('complex-values'), {
        fakeSecret : 'UG9pbnRsZXNzIHRvIGRlY29kZQ==',
        equation   : '5=10/2',
        number     : '3',
        sentence   : 'Hi there!'
    });
});

test('requires keys for environment variables', (t) => {
    const err = t.throws(() => {
        fixture('missing-key');
    }, Error);
    const filepath = path.join('fixture', 'missing-key', '.env');
    t.is(err.message, `Missing key for environment variable in ${filepath}`);
});

test('requires env files to be hidden', (t) => {
    const bad = 'env';
    const good = '.' + bad;
    const err = t.throws(() => {
        fixture('normal', bad);
    }, Error);
    t.is(err.message, `Filepath must be hidden, use "${good}" instead of "${bad}"`);
});

test('requires secure file permissions on .env', (t) => {
    const err = t.throws(() => {
        fixture('unsafe-perm-env-640');
    }, Error);
    const filepath = path.join('fixture', 'unsafe-perm-env-640', '.env');
    t.is(err.message, `File permissions are unsafe. Fix: chmod 600 '${filepath}'`);
});

test('requires secure file permissions on .env.example', (t) => {
    const err = t.throws(() => {
        fixture('unsafe-perm-example-602');
    }, Error);
    const filepath = path.join('fixture', 'unsafe-perm-example-602', '.env.example');
    t.is(err.message, `File must not be writable by others. Fix: chmod o-w '${filepath}'`);
});

test('requires at least one entry in .env.example', (t) => {
    const err = t.throws(() => {
        fixture('empty-example');
    }, Error);
    const filepath = path.join('fixture', 'empty-example', '.env.example');
    t.is(err.message, `At least one entry is required in ${filepath}`);
});

test('does not modify process.env', (t) => {
    const oldEnvDescriptor = Object.getOwnPropertyDescriptor(process, 'env');
    const oldEnv = process.env;
    const envCopy = Object.create(
        Object.getPrototypeOf(oldEnv),
        Object.getOwnPropertyDescriptors(oldEnv)
    );
    t.deepEqual(fixture('normal'), {
        myKey : 'my val',
        dog   : 'woof'
    });
    t.is(process.env, oldEnv);
    t.deepEqual(process.env, envCopy);
    t.deepEqual(Object.getOwnPropertyDescriptor(process, 'env'), oldEnvDescriptor);
});

test('disallows values in .env.example', (t) => {
    const err = t.throws(() => {
        fixture('example-has-values');
    }, Error);
    const envPath = path.join('fixture', 'example-has-values', '.env');
    const examplePath = envPath + '.example';
    t.is(err.message, `No values are allowed in ${examplePath}, put them in ${envPath} instead`);
});

test('friendly error if .env.example is not a file', (t) => {
    const err = t.throws(() => {
        fixture('example-not-file');
    }, Error);
    const filepath = path.join('fixture', 'example-not-file', '.env.example');
    t.is(err.message, `Filepath must be a file: ${filepath}`);
});

test('friendly error if .env is not a file', (t) => {
    const err = t.throws(() => {
        fixture('env-not-file');
    }, Error);
    const filepath = path.join('fixture', 'env-not-file', '.env');
    t.is(err.message, `Filepath must be a file: ${filepath}`);
});

test('requires all vars from .env.example', (t) => {
    const err = t.throws(() => {
        fixture('missing-env-entry');
    }, Error);
    t.is(err.message, `Environment variables are missing: MISSING, EMPTY`);
});
