#!/usr/bin/env bash
# Exit on error
set -o errexit

# Install production dependencies
pip install -r requirements/prod.txt

# Collect static files into STATIC_ROOT
python manage.py collectstatic --no-input

# Run migrations against database (Neon DB in production)
python manage.py migrate
