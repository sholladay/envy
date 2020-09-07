import path from 'path';
import test from 'ava';
import camelcase from 'camelcase';
import envy from '.';

const fixturePath = (dir, file = '.env') => {
    return path.join('fixture', dir, file);
};

const fixture = (dir, file) => {
    return envy(fixturePath(dir, file));
};

const monkey = (obj, prop) => {
    const original = Object.getOwnPropertyDescriptor(obj, prop);

    return () => {
        delete obj[prop];
        if (original) {
            Object.defineProperty(obj, prop, original);
        }
    };
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
    t.is(err.message, `Filepath must be hidden. Fix: mv '${bad}' '${good}'`);
});

test('requires secure file permissions on .env', (t) => {
    const err = t.throws(() => {
        fixture('unsafe-perm-env-640');
    }, Error);
    const filepath = path.join('fixture', 'unsafe-perm-env-640', '.env');
    t.is(err.message, `File permissions are unsafe. Fix: chmod 600 '${filepath}'`);
});

test('requires secure file permissions on .env in windows land', (t) => {
    const restore = monkey(process, 'platform');
    Object.defineProperty(process, 'platform', {
        configurable : true,
        value        : 'win32'
    });
    const err = t.throws(() => {
        fixture('unsafe-perm-windows-env-777');
    }, Error);
    const filepath = path.join('fixture', 'unsafe-perm-windows-env-777', '.env');
    t.is(err.message, `File permissions are unsafe. Make them 555 '${filepath}'`);

    restore();
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
    const oldEnv = process.env; // eslint-disable-line no-process-env
    const envCopy = Object.create(
        Object.getPrototypeOf(oldEnv),
        Object.getOwnPropertyDescriptors(oldEnv)
    );
    t.deepEqual(fixture('normal'), {
        myKey : 'my val',
        dog   : 'woof'
    });
    t.is(process.env, oldEnv); // eslint-disable-line no-process-env
    t.deepEqual(process.env, envCopy); // eslint-disable-line no-process-env
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
    t.is(err.message, 'Environment variables are missing: MISSING, EMPTY');
});

test('supports filepath as option', (t) => {
    const result = envy({
        filepath : fixturePath('normal')
    });
    t.deepEqual(result, {
        myKey : 'my val',
        dog   : 'woof'
    });
});

test('supports explicit env as option', (t) => {
    const result = envy({
        filepath : fixturePath('normal'),
        env      : {
            MY_KEY : 'my alternate val'
        }
    });
    t.deepEqual(result, {
        myKey : 'my alternate val',
        dog   : 'woof'
    });
});

test('ignores unknown global env vars by default', (t) => {
    const result = envy({
        filepath : fixturePath('normal'),
        env      : {
            UNKNOWN_VAR : 'this should not appear in result'
        }
    });
    t.deepEqual(result, {
        myKey : 'my val',
        dog   : 'woof'
    });
});

test('accepts all unknown global env vars when allowUnknown option is true', (t) => {
    const result = envy({
        filepath     : fixturePath('normal'),
        allowUnknown : true,
        env          : {
            DOG         : 'overridden woof',
            UNKNOWN_VAR : 'this should appear in result'
        }
    });
    t.deepEqual(result, {
        myKey      : 'my val',
        dog        : 'overridden woof',
        unknownVar : 'this should appear in result'
    });
});

test('accepts specific unknown global env vars when allowUnknown option is an array', (t) => {
    const result = envy({
        filepath     : fixturePath('normal'),
        allowUnknown : ['UNKNOWN_VAR'],
        env          : {
            DOG              : 'overridden woof',
            UNKNOWN_VAR      : 'this should appear in result',
            VERY_UNKNOWN_VAR : 'this should not appear in result'
        }
    });
    t.deepEqual(result, {
        myKey      : 'my val',
        dog        : 'overridden woof',
        unknownVar : 'this should appear in result'
    });
});
