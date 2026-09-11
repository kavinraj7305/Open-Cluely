const fs = require('fs');
const path = require('path');

const LOG_DIR_NAME = 'logs';
const LOG_FILE_NAME = 'ai-requests.jsonl';
const CONSOLE_PREVIEW_CHARS = 400;
const FILE_TEXT_CHARS = 20000;

function getLogDir() {
  return path.join(__dirname, '..', '..', '..', LOG_DIR_NAME);
}

function getLogFilePath() {
  return path.join(getLogDir(), LOG_FILE_NAME);
}

function createRequestId(action = 'ai') {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${action}-${stamp}-${rand}`;
}

function clip(value, maxChars = FILE_TEXT_CHARS) {
  const text = String(value ?? '');
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars)}\n...[truncated ${text.length - maxChars} chars]`;
}

function preview(value, maxChars = CONSOLE_PREVIEW_CHARS) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) {
    return '(empty)';
  }
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars)}…`;
}

function appendAiRequestLog(entry) {
  const record = {
    ts: new Date().toISOString(),
    ...entry
  };

  try {
    fs.mkdirSync(getLogDir(), { recursive: true });
    fs.appendFileSync(getLogFilePath(), `${JSON.stringify(record)}\n`, 'utf8');
  } catch (error) {
    console.error('Failed to write AI request log:', error.message);
  }

  return record;
}

function logAiEvent(requestId, message, extra = null) {
  const prefix = `[AI-LOG ${requestId}]`;
  if (extra == null) {
    console.log(prefix, message);
    return;
  }
  console.log(prefix, message, extra);
}

module.exports = {
  createRequestId,
  clip,
  preview,
  appendAiRequestLog,
  logAiEvent,
  getLogFilePath
};
