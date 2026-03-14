#!/bin/sh

# Copy to emptyDir to prevent permission issues with Caddy
cp -rv /app/html/* /var/www/html/

# Inject environment variables into the Angular app
ngssc insert /var/www/html/

exec caddy run --config /app/Caddyfile --adapter caddyfile
