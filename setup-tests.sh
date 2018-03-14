#!/usr/bin/env bash

set -eu;

# We need to set expected permissions before running tests because git does not bother to do so
# when cloning. So if we don't do this, tests will fail or have unexpected results in CI, etc.

chmod 600 fixture/*/.env;
chmod 640 'fixture/unsafe-perm-env-640/.env';
chmod 602 'fixture/unsafe-perm-example-602/.env.example';
chmod 777 'fixture/unsafe-perm-windows-env-777/.env';
