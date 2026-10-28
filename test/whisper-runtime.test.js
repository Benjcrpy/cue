const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { locateWhisperRuntime } = require('../src/whisper-runtime');

test('locateWhisperRuntime finds .cache runtime even when isPackaged is wrongly true (renamed electron)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cue-whisper-'));
  try {
    fs.writeFileSync(path.join(root, 'package.json'), '{"name":"cue"}');
    fs.writeFileSync(path.join(root, 'main.js'), '');
    const runtimeDir = path.join(root, '.cache', 'whisper-runtime', 'win32-x64');
    fs.mkdirSync(runtimeDir, { recursive: true });
    const exe = path.join(runtimeDir, 'whisper-server.exe');
    fs.writeFileSync(exe, '');

    const found = locateWhisperRuntime({
      isPackaged: true, // false positive from MicrosoftEdgeUpdate.exe rename
      resourcesPath: path.join(root, 'missing-resources'),
      appPath: root,
      platform: 'win32',
      architecture: 'x64',
      environment: {}
    });
    assert.equal(found.available, true);
    assert.equal(found.executablePath, exe);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('locateWhisperRuntime tells source users to prepare:whisper when cache is empty', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cue-whisper-'));
  try {
    fs.writeFileSync(path.join(root, 'package.json'), '{"name":"cue"}');
    fs.writeFileSync(path.join(root, 'main.js'), '');
    const miss = locateWhisperRuntime({
      isPackaged: true,
      resourcesPath: path.join(root, 'resources'),
      appPath: root,
      platform: 'win32',
      architecture: 'x64',
      environment: {}
    });
    assert.equal(miss.available, false);
    assert.match(miss.message, /prepare:whisper/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
