const { spawn } = require('child_process');
const path = require('path');

const OCR_TIMEOUT_MS = 30000;
const SCRIPT_PATH = path.join(__dirname, 'windows-ocr.ps1');

function ocrImageFile(imagePath) {
  const resolvedPath = path.resolve(String(imagePath || ''));

  return new Promise((resolve) => {
    if (!resolvedPath) {
      resolve('');
      return;
    }

    const child = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        SCRIPT_PATH,
        '-ImagePath',
        resolvedPath
      ],
      {
        windowsHide: true
      }
    );

    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = (text) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(String(text || '').trim());
    };

    const timeout = setTimeout(() => {
      try {
        child.kill();
      } catch {
        // ignore
      }
      console.error('Windows OCR timed out for', resolvedPath);
      finish('');
    }, OCR_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      console.error('Windows OCR failed to start:', error.message);
      finish('');
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        console.error('Windows OCR exited with code', code, stderr.trim());
        finish('');
        return;
      }
      finish(stdout);
    });
  });
}

async function ocrImageFiles(imagePaths) {
  const paths = Array.isArray(imagePaths) ? imagePaths : [];
  const files = [];
  const texts = [];

  for (const imagePath of paths) {
    const startedAt = Date.now();
    const text = await ocrImageFile(imagePath);
    files.push({
      path: imagePath,
      file: path.basename(String(imagePath || '')),
      chars: text.length,
      ms: Date.now() - startedAt,
      text
    });
    if (text) {
      texts.push(text);
    }
  }

  return {
    ocrText: texts.join('\n\n---\n\n'),
    files
  };
}

module.exports = {
  ocrImageFile,
  ocrImageFiles
};
