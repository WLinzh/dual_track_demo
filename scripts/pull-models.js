#!/usr/bin/env node
/**
 * Pull required Ollama models
 */

const { spawn } = require('child_process');

const models = [
  'qwen2.5:1.5b-instruct',
  'qwen2.5:14b-instruct',
  'qwen3-embedding'
];

console.log('📥 Pulling required Ollama models...\n');
console.log(`Models to pull: ${models.length}`);
console.log('This may take several minutes depending on your connection.\n');

async function pullModel(modelName) {
  return new Promise((resolve, reject) => {
    console.log(`⬇️  Pulling ${modelName}...`);
    
    const ollama = spawn('ollama', ['pull', modelName], {
      stdio: 'inherit',
      shell: true
    });

    ollama.on('close', (code) => {
      if (code === 0) {
        console.log(`✓ ${modelName} pulled successfully\n`);
        resolve();
      } else {
        console.log(`✗ Failed to pull ${modelName}\n`);
        reject(new Error(`Failed to pull ${modelName}`));
      }
    });

    ollama.on('error', (err) => {
      console.log(`✗ Error: ${err.message}\n`);
      reject(err);
    });
  });
}

async function main() {
  try {
    for (const model of models) {
      await pullModel(model);
    }
    
    console.log('✅ All models pulled successfully!');
    console.log('\nYou can now run: pnpm setup && pnpm dev');
  } catch (error) {
    console.error('\n❌ Model pulling failed:', error.message);
    console.error('\nMake sure Ollama is installed and running:');
    console.error('  - Install: https://ollama.ai');
    console.error('  - Start: ollama serve');
    process.exit(1);
  }
}

main();
