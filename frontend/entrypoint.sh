#!/bin/sh

# Copy to emptyDir to prevent permission issues with Caddy
cp -rv /app/html/* /srv/

# Inject environment variables into the Angular app
ngssc insert /srv

exec caddy run --config /app/Caddyfile --adapter caddyfile
