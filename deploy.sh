#!/bin/bash

# Company Board Deployment Script for EC2
# Usage: ./deploy.sh

set -e

echo "🚀 Starting deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found!${NC}"
    echo "Please copy .env.production to .env and configure it first:"
    echo "  cp .env.production .env"
    echo "  nano .env"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Error: Docker is not installed${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker compose &> /dev/null; then
    echo -e "${RED}❌ Error: Docker Compose is not installed${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Stopping existing containers...${NC}"
docker compose -f docker-compose.prod.yml down

echo -e "${YELLOW}🏗️  Building images...${NC}"
docker compose -f docker-compose.prod.yml build --progress=plain

echo -e "${YELLOW}🚀 Starting containers...${NC}"
docker compose -f docker-compose.prod.yml up -d

echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
sleep 10

echo -e "${YELLOW}🛠 Running database migrations...${NC}"
docker compose -f docker-compose.prod.yml exec -T backend alembic upgrade head

echo -e "${YELLOW}🌱 Ensuring default category data...${NC}"
docker compose -f docker-compose.prod.yml exec -T backend python -m app.ensure_default_categories || echo -e "${YELLOW}⚠️  Default category ensure failed${NC}"

echo -e "${YELLOW}🧩 Seeding MCP marketplace data...${NC}"
docker compose -f docker-compose.prod.yml exec -T backend python -m app.seed_mcp_data || echo -e "${YELLOW}⚠️  MCP marketplace seeding failed${NC}"

# Check if services are running
if docker compose -f docker-compose.prod.yml ps | grep -q "Up"; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo ""
    echo "Services status:"
    docker compose -f docker-compose.prod.yml ps
    echo ""
    echo -e "${GREEN}🌐 Application is running!${NC}"
    echo "Access your application at: https://jionc.com"
    echo ""
    echo "Useful commands:"
    echo "  View logs: docker compose -f docker-compose.prod.yml logs -f"
    echo "  Stop: docker compose -f docker-compose.prod.yml down"
    echo "  Restart: docker compose -f docker-compose.prod.yml restart"
else
    echo -e "${RED}❌ Deployment failed. Check logs:${NC}"
    docker compose -f docker-compose.prod.yml logs
    exit 1
fi
