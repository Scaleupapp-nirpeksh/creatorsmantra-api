#!/usr/bin/env node

/**
 * Install Dependencies Script
 * Installs all required dependencies for CreatorsMantra Backend
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('📦 Installing CreatorsMantra Backend Dependencies...');

try {
  // Check if package.json exists
  if (!fs.existsSync('package.json')) {
    console.error('❌ package.json not found. Run setup script first.');
    process.exit(1);
  }

  // Install dependencies
  console.log('📥 Installing production dependencies...');
  execSync('npm install', { stdio: 'inherit' });

  console.log('🔧 Installing development dependencies...');
  execSync('npm install --save-dev', { stdio: 'inherit' });

  console.log('✅ All dependencies installed successfully!');
  console.log('🚀 Run "npm run dev" to start the development server');

} catch (error) {
  console.error('❌ Error installing dependencies:', error.message);
  process.exit(1);
}
