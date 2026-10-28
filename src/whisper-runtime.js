const fs = require('fs');
const path = require('path');
const { getRuntimeExecutablePath, getRuntimeTarget, WHISPER_CPP_VERSION } = require('./whisper-runtime-manifest');

/** True when appPath is a real project dir (not inside app.asar). */
function isSourceAppPath(appPath) {
  if (!appPath || String(appPath).includes('app.asar')) return false;
  try {
    return fs.existsSync(path.join(appPath, 'package.json')) && fs.existsSync(path.join(appPath, 'main.js'));
  } catch (_) {
    return false;
  }
}

/**
 * Locate only prepackaged or explicitly prepared runtimes; never fetch code.
 *
 * Note: cue's postinstall renames electron.exe → MicrosoftEdgeUpdate.exe so Task
 * Manager looks like Edge Update. That makes Electron report app.isPackaged=true
 * even during `npm start`, so we must still look under `.cache/whisper-runtime`
 * whenever the app path is clearly the source tree.
 */
function locateWhisperRuntime({
  isPackaged,
  resourcesPath,
  appPath,
  platform = process.platform,
  architecture = process.arch,
  environment = process.env
}) {
  const target = getRuntimeTarget(platform, architecture);
  const candidates = [];
  const fromSource = isSourceAppPath(appPath);

  if (environment.CUE_WHISPER_RUNTIME) {
    candidates.push(path.resolve(environment.CUE_WHISPER_RUNTIME));
  }
  if (isPackaged && resourcesPath) {
    candidates.push(path.join(resourcesPath, 'whisper-runtime'));
  }
  // Dev / `npm start` (including renamed electron binary): prepared runtime lives here.
  if ((!isPackaged || fromSource) && appPath) {
    candidates.push(path.join(appPath, '.cache', 'whisper-runtime', target.key));
  }

  for (const runtimeDirectory of candidates) {
    const executablePath = getRuntimeExecutablePath(runtimeDirectory, platform, architecture);
    if (fs.existsSync(executablePath)) {
      return {
        available: true,
        version: WHISPER_CPP_VERSION,
        target: target.key,
        runtimeDirectory,
        executablePath
      };
    }
  }

  const treatAsSource = !isPackaged || fromSource;
  return {
    available: false,
    version: WHISPER_CPP_VERSION,
    target: target.key,
    runtimeDirectory: candidates[0] || null,
    executablePath: null,
    message: treatAsSource
      ? 'Run npm run prepare:whisper before using local transcription from source.'
      : `The packaged Whisper runtime for ${target.key} is missing.`
  };
}

module.exports = { locateWhisperRuntime };
