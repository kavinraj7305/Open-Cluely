const fs = require('fs');
const path = require('path');

const APP_STATE_DIR_NAME = 'cache';
const APP_STATE_FILE_NAME = 'app-state.json';

function getDefaultAppState() {
  return {
    aiProvider: null,
    geminiApiKey: null,
    grokApiKey: null,
    groqApiKey: null,
    bedrockApiKey: null,
    assemblyAiApiKey: null,
    geminiApiKeyIndex: 0,
    grokApiKeyIndex: 0,
    groqApiKeyIndex: 0,
    bedrockApiKeyIndex: 0,
    geminiModel: null,
    grokModel: null,
    groqModel: null,
    bedrockModel: null,
    bedrockRegion: null,
    ollamaBaseUrl: null,
    ollamaModel: null,
    assemblyAiSpeechModel: null,
    programmingLanguage: null,
    windowOpacityLevel: 10,
    themePreference: null
  };
}

function sanitizeAppState(state) {
  const nextState = getDefaultAppState();

  if (state && typeof state === 'object' && !Array.isArray(state)) {
    const aiProvider = String(state.aiProvider ?? '').trim().toLowerCase();
    if (aiProvider === 'gemini' || aiProvider === 'grok' || aiProvider === 'groq' || aiProvider === 'bedrock' || aiProvider === 'ollama') {
      nextState.aiProvider = aiProvider;
    }

    if (typeof state.geminiApiKey === 'string') {
      const geminiApiKey = state.geminiApiKey.trim();
      nextState.geminiApiKey = geminiApiKey || null;
    }

    if (typeof state.grokApiKey === 'string') {
      const grokApiKey = state.grokApiKey.trim();
      nextState.grokApiKey = grokApiKey || null;
    }

    if (typeof state.groqApiKey === 'string') {
      const groqApiKey = state.groqApiKey.trim();
      nextState.groqApiKey = groqApiKey || null;
    }

    if (typeof state.bedrockApiKey === 'string') {
      const bedrockApiKey = state.bedrockApiKey.trim();
      nextState.bedrockApiKey = bedrockApiKey || null;
    }

    if (typeof state.assemblyAiApiKey === 'string') {
      const assemblyAiApiKey = state.assemblyAiApiKey.trim();
      nextState.assemblyAiApiKey = assemblyAiApiKey || null;
    }

    const geminiApiKeyIndex = Number.parseInt(String(state.geminiApiKeyIndex ?? ''), 10);
    if (Number.isFinite(geminiApiKeyIndex) && geminiApiKeyIndex >= 0) {
      nextState.geminiApiKeyIndex = geminiApiKeyIndex;
    }

    const grokApiKeyIndex = Number.parseInt(String(state.grokApiKeyIndex ?? ''), 10);
    if (Number.isFinite(grokApiKeyIndex) && grokApiKeyIndex >= 0) {
      nextState.grokApiKeyIndex = grokApiKeyIndex;
    }

    const groqApiKeyIndex = Number.parseInt(String(state.groqApiKeyIndex ?? ''), 10);
    if (Number.isFinite(groqApiKeyIndex) && groqApiKeyIndex >= 0) {
      nextState.groqApiKeyIndex = groqApiKeyIndex;
    }

    const bedrockApiKeyIndex = Number.parseInt(String(state.bedrockApiKeyIndex ?? ''), 10);
    if (Number.isFinite(bedrockApiKeyIndex) && bedrockApiKeyIndex >= 0) {
      nextState.bedrockApiKeyIndex = bedrockApiKeyIndex;
    }

    if (typeof state.geminiModel === 'string' && state.geminiModel.trim()) {
      nextState.geminiModel = state.geminiModel.trim();
    }

    if (typeof state.grokModel === 'string' && state.grokModel.trim()) {
      nextState.grokModel = state.grokModel.trim();
    }

    if (typeof state.groqModel === 'string' && state.groqModel.trim()) {
      nextState.groqModel = state.groqModel.trim();
    }

    if (typeof state.bedrockModel === 'string' && state.bedrockModel.trim()) {
      nextState.bedrockModel = state.bedrockModel.trim();
    }

    if (typeof state.bedrockRegion === 'string' && state.bedrockRegion.trim()) {
      nextState.bedrockRegion = state.bedrockRegion.trim();
    }

    if (typeof state.ollamaBaseUrl === 'string' && state.ollamaBaseUrl.trim()) {
      nextState.ollamaBaseUrl = state.ollamaBaseUrl.trim();
    }

    if (typeof state.ollamaModel === 'string' && state.ollamaModel.trim()) {
      nextState.ollamaModel = state.ollamaModel.trim();
    }

    if (typeof state.assemblyAiSpeechModel === 'string' && state.assemblyAiSpeechModel.trim()) {
      nextState.assemblyAiSpeechModel = state.assemblyAiSpeechModel.trim();
    }

    if (typeof state.programmingLanguage === 'string' && state.programmingLanguage.trim()) {
      nextState.programmingLanguage = state.programmingLanguage.trim();
    }

    const windowOpacityLevel = Number.parseInt(String(state.windowOpacityLevel ?? ''), 10);
    if (Number.isFinite(windowOpacityLevel)) {
      nextState.windowOpacityLevel = Math.min(Math.max(windowOpacityLevel, 1), 10);
    }

    const themePreference = String(state.themePreference ?? '').trim().toLowerCase();
    if (themePreference === 'dark' || themePreference === 'light') {
      nextState.themePreference = themePreference;
    }
  }

  if (!nextState.groqApiKey && String(nextState.grokApiKey || '').startsWith('gsk_')) {
    nextState.groqApiKey = nextState.grokApiKey;
    if (!nextState.geminiApiKey && (nextState.aiProvider === 'gemini' || nextState.aiProvider === 'grok' || !nextState.aiProvider)) {
      nextState.aiProvider = 'groq';
    }
  }

  return nextState;
}

function getAppStateBaseDir(app) {
  // Dev: project root next to package.json so devs can inspect state easily.
  if (app && !app.isPackaged) {
    return path.join(__dirname, '..', '..', '..');
  }

  // Packaged: userData (e.g. %APPDATA%/<productName> on Windows). Critical for
  // portable builds — the EXE extracts to a temp dir each launch, so writing
  // beside the EXE means state is wiped every run.
  if (app) {
    return app.getPath('userData');
  }

  return path.join(__dirname, '..', '..', '..');
}

function getAppStateDir(app) {
  return path.join(getAppStateBaseDir(app), APP_STATE_DIR_NAME);
}

function getAppStatePath(app) {
  return path.join(getAppStateDir(app), APP_STATE_FILE_NAME);
}

function ensureAppStateDir(app) {
  fs.mkdirSync(getAppStateDir(app), { recursive: true });
}

function writeAppStateFile(app, state) {
  ensureAppStateDir(app);
  fs.writeFileSync(
    getAppStatePath(app),
    `${JSON.stringify(state, null, 2)}\n`,
    'utf8'
  );
}

function loadAppState(app) {
  const appStatePath = getAppStatePath(app);

  try {
    ensureAppStateDir(app);

    if (!fs.existsSync(appStatePath)) {
      const defaultState = getDefaultAppState();
      writeAppStateFile(app, defaultState);
      return defaultState;
    }

    const fileContent = fs.readFileSync(appStatePath, 'utf8');
    const sanitizedState = sanitizeAppState(JSON.parse(fileContent));
    writeAppStateFile(app, sanitizedState);
    return sanitizedState;
  } catch (error) {
    console.error('Failed to load app state:', error);
    return getDefaultAppState();
  }
}

function saveAppState(app, partialState = {}) {
  ensureAppStateDir(app);

  const currentState = loadAppState(app);
  const nextState = sanitizeAppState({
    ...currentState,
    ...partialState
  });

  writeAppStateFile(app, nextState);

  return nextState;
}

module.exports = {
  getDefaultAppState,
  getAppStatePath,
  loadAppState,
  saveAppState
};
