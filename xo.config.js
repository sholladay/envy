import tidy from 'eslint-config-tidy';

const configs = [
    ...tidy,
    {
        rules : {
            'no-bitwise'                        : 'off',
            'no-shadow'                         : 'off',
            'no-sync'                           : 'off',
            'unicorn/no-array-reduce'           : 'off',
            'unicorn/prefer-default-parameters' : 'off'
        }
    }
];

export default configs;
