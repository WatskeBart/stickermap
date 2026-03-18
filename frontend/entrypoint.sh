#!/bin/sh
set -eu

cp -r /app/html/* /srv/

ngssc insert /srv

exec "$@"
