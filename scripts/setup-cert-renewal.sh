#!/bin/bash
# One-time setup: issue/renew Let's Encrypt certs for jionc.com + blog.jionc.com
# and register a cron job that auto-renews them and reloads the dockerized nginx.
#
# Usage (run on the EC2 host, from anywhere):
#   sudo ./scripts/setup-cert-renewal.sh you@example.com

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root (sudo ./scripts/setup-cert-renewal.sh you@example.com)${NC}"
    exit 1
fi

EMAIL="$1"
if [ -z "$EMAIL" ]; then
    echo -e "${RED}❌ Error: contact email required${NC}"
    echo "Usage: sudo ./scripts/setup-cert-renewal.sh you@example.com"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.prod.yml"
WEBROOT="$SCRIPT_DIR/certbot/www"
RELOAD_CMD="docker compose -f $COMPOSE_FILE restart nginx"

echo -e "${YELLOW}📦 Installing certbot (if missing)...${NC}"
if ! command -v certbot &> /dev/null; then
    apt-get update -y
    apt-get install -y certbot
fi

if [ ! -d "/etc/letsencrypt/live/jionc.com" ]; then
    echo -e "${YELLOW}🔐 No existing certificate found — issuing a new one...${NC}"
    certbot certonly --webroot -w "$WEBROOT" \
        -d jionc.com -d www.jionc.com -d blog.jionc.com \
        --email "$EMAIL" --agree-tos --non-interactive
else
    echo -e "${GREEN}✅ Existing certificate found for jionc.com, skipping initial issuance.${NC}"
fi

CRON_LINE="0 3,15 * * * certbot renew --webroot -w $WEBROOT --deploy-hook \"$RELOAD_CMD\" >> /var/log/certbot-renew.log 2>&1"

echo -e "${YELLOW}⏰ Registering renewal cron job (twice daily, per Let's Encrypt recommendation)...${NC}"
( crontab -l 2>/dev/null | grep -v "certbot renew.*$WEBROOT" ; echo "$CRON_LINE" ) | crontab -

echo -e "${GREEN}✅ Done.${NC}"
echo "  Cert path:   /etc/letsencrypt/live/jionc.com/"
echo "  Renew check: twice daily via cron (03:00 / 15:00)"
echo "  On renewal:  '$RELOAD_CMD' runs automatically to reload nginx"
echo ""
echo "Verify anytime with: sudo certbot renew --dry-run"
