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

echo -e "${YELLOW}🌱 Seeding category data...${NC}"
if CATEGORY_COUNT_RAW=$(docker exec company_board_backend python -c "from app.db.session import SessionLocal; from app.models.category import Category; db=SessionLocal(); print(db.query(Category).count()); db.close()" 2>/dev/null); then
    CATEGORY_COUNT=$(echo "${CATEGORY_COUNT_RAW}" | tr -dc '0-9')

    if [ -z "${CATEGORY_COUNT}" ]; then
        echo -e "${YELLOW}⚠️  Could not parse category count. Trying safe non-interactive seed...${NC}"
        printf "n\n" | docker exec -i company_board_backend python -m seed_categories || echo -e "${YELLOW}⚠️  Category seeding skipped${NC}"
    elif [ "${CATEGORY_COUNT}" -eq 0 ]; then
        docker exec company_board_backend python -m seed_categories || echo -e "${YELLOW}⚠️  Category seeding failed${NC}"
    else
        echo -e "${YELLOW}ℹ️  Categories already exist (${CATEGORY_COUNT}). Skipping seed.${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Could not check category count. Trying safe non-interactive seed...${NC}"
    printf "n\n" | docker exec -i company_board_backend python -m seed_categories || echo -e "${YELLOW}⚠️  Category seeding skipped${NC}"
fi

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
    echo "Access your application at: http://3.89.59.227"
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
