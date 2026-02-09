#!/bin/bash

# Debugging script for deployment issues

echo "=== Checking nginx container files ==="
docker exec company_board_nginx ls -la /usr/share/nginx/html/

echo ""
echo "=== Checking if index.html exists ==="
docker exec company_board_nginx cat /usr/share/nginx/html/index.html 2>&1 | head -20

echo ""
echo "=== Rebuilding with verbose output ==="
docker compose -f docker-compose.prod.yml build --no-cache nginx 2>&1 | grep -E "(Step|Building|COPY|RUN npm)"

echo ""
echo "=== Container logs ==="
docker compose -f docker-compose.prod.yml logs nginx | tail -50
