#!/bin/bash

set -euo pipefail

# Usage: ./bump-version.sh <new_version>
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <new_version>"
    echo ""
    echo "Example: $0 1.2.3"
    exit 1
fi

VERSION="$1"

# frontend/package.json
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" frontend/package.json

# backend/pyproject.toml
sed -i "s/^version = \"[^\"]*\"/version = \"$VERSION\"/" backend/pyproject.toml

# backend/main.py (FastAPI app version)
sed -i "s/version=\"[^\"]*\"/version=\"$VERSION\"/" backend/main.py

# database_migrations/pyproject.toml
sed -i "s/^version = \"[^\"]*\"/version = \"$VERSION\"/" database_migrations/pyproject.toml

# helm umbrella chart - appVersion only (chart version tracks chart changes separately)
sed -i "s/^appVersion: .*/appVersion: \"$VERSION\"/" helm/stickermap/Chart.yaml