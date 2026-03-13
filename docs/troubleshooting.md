# Troubleshooting

## Common Issues

### Port conflicts

Change port mappings in `compose.yml` or `compose.prod.yml` to avoid conflicts with other services on the host.

### Database connection errors

```bash
# Check if PostGIS is running
podman ps | grep stickermap-postgis

# Restart the backend
podman compose restart backend
```

### CORS errors

- Verify CORS middleware in `backend/main.py`
- Check that `CORS_ALLOWED_ORIGINS` in `backend/.env` includes the frontend URL

### Image upload fails

- Max file size: **16 MB**
- Accepted types: JPEG, PNG, GIF, WebP
- Ensure the `uploads/` directory exists and is writable

### No GPS data extracted

- Only original camera photos contain GPS EXIF data
- Many social platforms and messaging apps strip EXIF metadata on upload
- Use the manual location picker in the UI as a fallback

### Map not loading

- Check the browser console for errors
- Verify MapLibre GL assets are loading in the network tab
- Confirm tile requests to the configured tile server are succeeding

### Keycloak authentication fails

```bash
# Check if Keycloak is running
podman ps | grep stickermap-keycloak

# Verify JWKS endpoint is reachable
curl http://localhost:8080/realms/stickermap/protocol/openid-connect/certs
```

- Verify the realm and `stickermap-client` exist in the admin console
- Confirm redirect URIs include `http://localhost:4200/*`
- Clear browser localStorage and try again

### Token validation fails (401 errors)

- Verify `KEYCLOAK_URL` in `backend/.env` matches the issuer claim in the JWT
- In containerized environments, set `KEYCLOAK_INTERNAL_URL` to the internal hostname (e.g., `http://keycloak:8080`)
- Check that `KEYCLOAK_CLIENT_ID` matches in all configs

### Infinite redirect loop

- Clear localStorage and sessionStorage in the browser
- Check for conflicting redirect URIs in the Keycloak client config

---

## Debug Mode

Set `LOG_LEVEL=DEBUG` in `backend/.env` to enable verbose logging from all backend modules:

```bash
# backend/.env
LOG_LEVEL=DEBUG
```

Valid values: `DEBUG`, `INFO` (default), `WARNING`, `ERROR`.

**View container logs:**

```bash
podman compose logs -f backend
podman logs stickermap-keycloak
```

---

## Database

### Interactive access

```bash
podman exec -it stickermap-postgis psql -U user -d stickermap

-- View all stickers
SELECT id, poster, ST_AsText(location) FROM stickers;

-- Check PostGIS version
SELECT PostGIS_Version();
```

### Backup

```bash
# Database
podman exec stickermap-postgis pg_dump -U user stickermap > backup.sql

# Restore
cat backup.sql | podman exec -i stickermap-postgis psql -U user -d stickermap

# Uploads volume
podman run --rm -v backend_uploads:/data -v $(pwd):/backup:Z alpine \
  tar czf /backup/uploads-backup.tar.gz -C /data .
```
