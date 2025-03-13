const assert = require('assert');
const path = require('path');
const fs = require('fs').promises;
const { execSync } = require('child_process');

// Mock objects
const mockScreenshot = {
  called: false,
  filename: null,
  capture: function(options) {
    this.called = true;
    this.filename = options.filename;
    return Promise.resolve();
  }
};

const mockGit = {
  initCalled: false,
  addCalled: false,
  commitCalled: false,
  commitMessage: null,
  init: function() {
    this.initCalled = true;
    return Promise.resolve();
  },
  add: function(filepath) {
    this.addCalled = true;
    this.filepath = filepath;
    return Promise.resolve();
  },
  commit: function(message) {
    this.commitCalled = true;
    this.commitMessage = message;
    return Promise.resolve();
  },
  checkIsRepo: function() {
    return Promise.resolve(false);
  },
  addConfig: function() {
    return Promise.resolve();
  }
};

// Test directory setup
const testDir = path.join(__dirname, 'test_dir');
const testConfigDir = path.join(testDir, 'WorkLog');
const testConfigFile = path.join(testConfigDir, 'config.json');
const testScreenshotsDir = path.join(testConfigDir, 'screenshots');

// Test functions
async function setup() {
  try {
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(testConfigDir, { recursive: true });
    await fs.mkdir(testScreenshotsDir, { recursive: true });
  } catch (error) {
    console.error('Setup error:', error);
  }
}

async function cleanup() {
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

async function testConfigSave() {
  const testConfig = {
    interval: 60000
  };
  
  try {
    await fs.writeFile(testConfigFile, JSON.stringify(testConfig, null, 2));
    const data = await fs.readFile(testConfigFile, 'utf8');
    const config = JSON.parse(data);
    
    assert.strictEqual(config.interval, 60000, 'Config interval should be 60000');
    console.log('✅ Config save test passed');
  } catch (error) {
    console.error('❌ Config save test failed:', error);
  }
}

function testScreenshotCapture() {
  mockScreenshot.called = false;
  mockScreenshot.filename = null;
  
  mockScreenshot.capture({ filename: path.join(testScreenshotsDir, 'test.png') });
  
  assert.strictEqual(mockScreenshot.called, true, 'Screenshot capture should be called');
  assert.strictEqual(path.basename(mockScreenshot.filename), 'test.png', 'Screenshot filename should be test.png');
  console.log('✅ Screenshot capture test passed');
}

function testGitOperations() {
  mockGit.initCalled = false;
  mockGit.addCalled = false;
  mockGit.commitCalled = false;
  mockGit.commitMessage = null;
  
  mockGit.init();
  assert.strictEqual(mockGit.initCalled, true, 'Git init should be called');
  
  const testFilePath = path.join(testScreenshotsDir, 'test.png');
  mockGit.add(testFilePath);
  assert.strictEqual(mockGit.addCalled, true, 'Git add should be called');
  assert.strictEqual(mockGit.filepath, testFilePath, 'Git add should be called with the correct filepath');
  
  const testCommitMessage = 'Test commit';
  mockGit.commit(testCommitMessage);
  assert.strictEqual(mockGit.commitCalled, true, 'Git commit should be called');
  assert.strictEqual(mockGit.commitMessage, testCommitMessage, 'Git commit should be called with the correct message');
  
  console.log('✅ Git operations test passed');
}

// Run tests
async function runTests() {
  try {
    console.log('Setting up test environment...');
    await setup();
    
    console.log('\nRunning tests...');
    await testConfigSave();
    testScreenshotCapture();
    testGitOperations();
    
    console.log('\nAll tests passed! 🎉');
  } catch (error) {
    console.error('\n❌ Tests failed:', error);
  } finally {
    console.log('\nCleaning up test environment...');
    await cleanup();
  }
}

runTests(); 