#!/bin/bash
# Cleanup script for nginx same-origin test

echo "Stopping nginx container..."
docker compose down

echo "✅ Nginx test environment cleaned up"
echo ""
echo "Frontend (localhost:3000) and Backend (localhost:8000) are still running."
echo "You can stop them manually if needed."

