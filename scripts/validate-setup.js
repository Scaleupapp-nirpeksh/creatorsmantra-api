#!/usr/bin/env node

/**
 * Setup Validation Script
 * Validates that all required files and configurations are in place
 */

const fs = require('fs');
const path = require('path');

const requiredFiles = [
  'package.json',
  '.env.example',
  'server.js',
  'src/app.js',
  'src/shared/utils.js',
  'src/shared/middleware.js',
  'src/modules/auth/model.js',
  'src/modules/deals/model.js',
  'src/modules/subscriptions/model.js'
];

const requiredDirs = [
  'src/modules',
  'src/shared',
  'src/shared/services',
  'docs',
  'scripts'
];

console.log('🔍 Validating CreatorsMantra Backend Setup...');

let hasErrors = false;

// Check required directories
requiredDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    console.error(`❌ Missing directory: ${dir}`);
    hasErrors = true;
  } else {
    console.log(`✅ Directory exists: ${dir}`);
  }
});

// Check required files
requiredFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    console.error(`❌ Missing file: ${file}`);
    hasErrors = true;
  } else {
    console.log(`✅ File exists: ${file}`);
  }
});

if (hasErrors) {
  console.error('❌ Setup validation failed. Please run the setup script again.');
  process.exit(1);
} else {
  console.log('✅ Setup validation passed! All required files and directories are in place.');
  console.log('🚀 Ready to start development!');
}
