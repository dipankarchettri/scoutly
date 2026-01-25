#!/bin/bash
# Phase 1 Installation & Testing Script
# Hybrid Performance Upgrades for Scoutly

echo "🚀 Scoutly Phase 1: Performance Upgrades Installation"
echo "=================================================="

# Check if Bun is installed
if ! command -v bun &> /dev/null; then
    echo "📦 Installing Bun runtime..."
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    echo "✅ Bun installed successfully"
else
    echo "✅ Bun already installed: $(bun --version)"
fi

# Install/upgrade dependencies
echo "📚 Installing dependencies with Bun..."
bun install

# Install new BullMQ Pro dependency if not present
if ! bun pm list @bullmq/pro &> /dev/null; then
    echo "➕ Adding BullMQ Pro..."
    bun add @bullmq/pro
fi

echo "✅ Dependencies installed"

# Test compilation
echo "🔍 Testing TypeScript compilation..."
bun run build 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ TypeScript compilation successful"
else
    echo "❌ TypeScript compilation failed"
    exit 1
fi

# Create environment configuration for DragonflyDB
echo "🐉 Setting up DragonflyDB configuration..."
cat > .env.phase1 << EOF
# Database Configuration
MONGODB_URI=${MONGODB_URI:-mongodb://localhost:27017/scoutly}

# Cache Configuration (DragonflyDB)
REDIS_HOST=localhost
REDIS_PORT=6379
CACHE_PROVIDER=dragonfly

# Runtime Configuration
NODE_RUNTIME=bun
NODE_ENV=development
EOF

echo "✅ Environment configuration created"

# Test DragonflyDB connectivity
echo "🧪 Testing DragonflyDB connectivity..."
bun -e "
import Redis from 'ioredis';
const redis = new Redis({ host: 'localhost', port: 6379 });
redis.on('connect', () => {
    console.log('✅ DragonflyDB connection successful');
    process.exit(0);
});
redis.on('error', (err) => {
    console.log('❌ DragonflyDB connection failed:', err.message);
    process.exit(1);
});
setTimeout(() => {
    console.log('⏰ DragonflyDB connection timeout');
    process.exit(1);
}, 5000);
"

if [ $? -eq 0 ]; then
    echo "✅ DragonflyDB is accessible"
else
    echo "⚠️  DragonflyDB not running - install with: docker run -p 6379:6379 --rm docker.dragonflydb/dragonfly"
fi

# Create Docker Compose for easy setup
echo "🐳 Creating docker-compose.phase1.yml..."
cat > docker-compose.phase1.yml << EOF
version: '3.8'
services:
  scoutly:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=${MONGODB_URI}
      - REDIS_HOST=dragonfly
      - CACHE_PROVIDER=dragonfly
      - NODE_RUNTIME=bun
    depends_on:
      - dragonfly
      - mongodb

  dragonfly:
    image: docker.dragonflydb/dragonfly:latest
    ports:
      - "6379:6379"
    volumes:
      - dragonfly_data:/data
    command: dragonfly --dir /data

  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    environment:
      - MONGO_INITDB_DATABASE=scoutly

volumes:
  dragonfly_data:
  mongodb_data:
EOF

echo "✅ Docker Compose configuration created"

# Performance test script
echo "⚡ Creating performance test script..."
cat > performance-test.js << EOF
import { performance } from 'perf_hooks';

async function testPerformance() {
    const iterations = 100000;
    
    console.log('🧪 Starting performance test...');
    const start = performance.now();
    
    // Simulate heavy processing
    let sum = 0;
    for (let i = 0; i < iterations; i++) {
        sum += Math.random() * Math.sin(i);
    }
    
    const end = performance.now();
    const duration = end - start;
    
    console.log(\`📊 Performance Test Results:\`);
    console.log(\`  Iterations: \${iterations.toLocaleString()}\`);
    console.log(\`  Duration: \${duration.toFixed(2)}ms\`);
    console.log(\`  Ops/sec: \${Math.round(iterations / (duration / 1000))}\`);
    console.log(\`  Runtime: \${process.version}\`);
    console.log(\`  Memory: \${JSON.stringify(process.memoryUsage())}\`);
}

testPerformance().catch(console.error);
EOF

echo "✅ Performance test script created"

echo ""
echo "🎯 Phase 1 Installation Complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Start MongoDB: docker run -p 27017:27017 mongo:7"
echo "2. Start DragonflyDB: docker run -p 6379:6379 docker.dragonflydb/dragonfly"
echo "3. Load environment: source .env.phase1"
echo "4. Run development server: bun run src/server.ts"
echo "5. Run performance test: bun performance-test.js"
echo "6. Run with Docker Compose: docker-compose -f docker-compose.phase1.yml up"
echo ""
echo "📊 Monitor performance at: http://localhost:5000/api/health"
echo ""
echo "🚀 Happy testing!"