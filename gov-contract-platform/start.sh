#!/bin/bash
# Gov Contract Platform - Quick Start Script

echo "🚀 Gov Contract Platform - Enterprise Contract Lifecycle Management"
echo "=================================================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

echo "📦 Starting platform services..."
cd infra

# Create .env if not exists
if [ ! -f .env ]; then
    echo "📝 Creating default .env file..."
    cat > .env << EOF
# Database
DB_USER=govuser
DB_PASSWORD=govpass
DB_NAME=govplatform
DB_PORT=5432

# Redis
REDIS_PASSWORD=redispass
REDIS_PORT=6379

# Elasticsearch
ES_PORT=9200
KIBANA_PORT=5601

# MinIO
MINIO_USER=minioadmin
MINIO_PASSWORD=minioadmin
MINIO_API_PORT=9000
MINIO_CONSOLE_PORT=9001
STORAGE_BUCKET=govplatform

# API
API_PORT=8000
NGINX_PORT=80

# Environment
ENVIRONMENT=development
DEBUG=true
SECRET_KEY=dev-secret-key-change-in-production

# AI Services (Optional)
# TYPHOON_API_KEY=your-api-key-here
# OPENAI_API_KEY=your-api-key-here
EOF
fi

# Start services
echo "🐳 Starting Docker Compose services..."
docker-compose down -v 2>/dev/null
docker-compose up -d --build

# Wait for services
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check health
echo "🏥 Checking service health..."

# Check PostgreSQL
until docker exec gcp-postgres pg_isready -U govuser > /dev/null 2>&1; do
    echo "  ⏳ Waiting for PostgreSQL..."
    sleep 2
done
echo "  ✅ PostgreSQL ready"

# Check Elasticsearch
until curl -s http://localhost:9200/_cluster/health > /dev/null 2>&1; do
    echo "  ⏳ Waiting for Elasticsearch..."
    sleep 2
done
echo "  ✅ Elasticsearch ready"

# Check Redis
until docker exec gcp-redis redis-cli ping > /dev/null 2>&1; do
    echo "  ⏳ Waiting for Redis..."
    sleep 2
done
echo "  ✅ Redis ready"

# Check MinIO
until curl -s http://localhost:9000/minio/health/live > /dev/null 2>&1; do
    echo "  ⏳ Waiting for MinIO..."
    sleep 2
done
echo "  ✅ MinIO ready"

# Wait for backend
echo "  ⏳ Waiting for Backend API..."
sleep 5
until curl -s http://localhost:8000/health > /dev/null 2>&1; do
    echo "  ⏳ Waiting for Backend API..."
    sleep 2
done
echo "  ✅ Backend API ready"

echo ""
echo "=================================================================="
echo "🎉 Gov Contract Platform is ready!"
echo "=================================================================="
echo ""
echo "📱 Access Points:"
echo "  • API Documentation: http://localhost:8000/docs"
echo "  • API Health Check:  http://localhost:8000/health"
echo "  • Kibana Dashboard:  http://localhost:5601"
echo "  • MinIO Console:     http://localhost:9001 (minioadmin/minioadmin)"
echo ""
echo "🛠️  Useful Commands:"
echo "  • View logs:        docker-compose -f infra/docker-compose.yml logs -f"
echo "  • Stop platform:    docker-compose -f infra/docker-compose.yml down"
echo "  • Reset data:       docker-compose -f infra/docker-compose.yml down -v"
echo ""
echo "📖 Next Steps:"
echo "  1. Open API docs: http://localhost:8000/docs"
echo "  2. Test the APIs using Swagger UI"
echo "  3. Start building your contract management workflow!"
echo ""
echo "🔧 For Production:"
echo "  - Update SECRET_KEY in .env"
echo "  - Configure SSL certificates"
echo "  - Set up proper backup strategy"
echo "  - Enable monitoring and alerting"
echo ""
