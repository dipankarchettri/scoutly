import { performance } from 'perf_hooks';

console.log('🧪 Testing Bun Performance...');

const start = performance.now();
let iterations = 100000;

// Simulate some processing
let sum = 0;
for (let i = 0; i < iterations; i++) {
    sum += Math.random() * Math.sin(i);
}

const end = performance.now();
const duration = end - start;

console.log(`📊 Performance Test Results:`);
console.log(`  Iterations: ${iterations.toLocaleString()}`);
console.log(`  Duration: ${duration.toFixed(2)}ms`);
console.log(`  Ops/sec: ${Math.round(iterations / (duration / 1000))}`);
console.log(`  Runtime: ${process.version}`);
console.log(`  Memory: ${JSON.stringify(process.memoryUsage())}`);