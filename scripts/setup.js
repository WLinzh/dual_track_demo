#!/usr/bin/env node
/**
 * Setup Script - Initialize database and seed data
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Setting up Dual-Track Demo...\n');

// Check if Ollama is running
async function checkOllama() {
  console.log('1️⃣  Checking Ollama...');
  return new Promise((resolve) => {
    const http = require('http');
    const req = http.get('http://127.0.0.1:11434/api/tags', (res) => {
      if (res.statusCode === 200) {
        console.log('   ✓ Ollama is running\n');
        resolve(true);
      } else {
        console.log('   ✗ Ollama responded but with error\n');
        resolve(false);
      }
    });
    req.on('error', () => {
      console.log('   ✗ Ollama is not running');
      console.log('   Please start Ollama: ollama serve\n');
      resolve(false);
    });
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Create .env file if not exists
function createEnvFile() {
  console.log('2️⃣  Creating environment file...');
  const envPath = path.join(__dirname, '..', '.env');
  const envExamplePath = path.join(__dirname, '..', '.env.example');
  
  if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('   ✓ .env created from .env.example\n');
  } else {
    console.log('   ✓ .env already exists\n');
  }
}

// Create data directory
function createDataDir() {
  console.log('3️⃣  Creating data directory...');
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('   ✓ data/ directory created\n');
  } else {
    console.log('   ✓ data/ directory exists\n');
  }
}

// Install Python dependencies
async function installPythonDeps() {
  console.log('4️⃣  Installing Python dependencies...');
  return new Promise((resolve, reject) => {
    const apiDir = path.join(__dirname, '..', 'services', 'api');
    const reqPath = path.join(apiDir, 'requirements.txt');
    
    if (!fs.existsSync(reqPath)) {
      console.log('   ✗ requirements.txt not found\n');
      resolve(false);
      return;
    }

    const pip = spawn('pip3', ['install', '-r', reqPath], {
      stdio: 'inherit',
      shell: true
    });

    pip.on('close', (code) => {
      if (code === 0) {
        console.log('   ✓ Python dependencies installed\n');
        resolve(true);
      } else {
        console.log('   ⚠ Python deps installation failed (non-critical)\n');
        resolve(false);
      }
    });

    pip.on('error', () => {
      console.log('   ⚠ pip3 not found (skip if using venv)\n');
      resolve(false);
    });
  });
}

async function main() {
  const ollamaOk = await checkOllama();
  
  createEnvFile();
  createDataDir();
  await installPythonDeps();
  
  console.log('✅ Setup complete!\n');
  console.log('Next steps:');
  console.log('  1. Pull Ollama models: pnpm ollama:pull');
  console.log('  2. Start services: pnpm dev');
  console.log('');
  
  if (!ollamaOk) {
    console.log('⚠️  Warning: Ollama is not running.');
    console.log('   Start it with: ollama serve');
    console.log('');
  }
}

main().catch(console.error);
