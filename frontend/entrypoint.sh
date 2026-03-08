#!/bin/sh

# Inject environment variables into the Angular app
ngssc insert /var/www/html

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
