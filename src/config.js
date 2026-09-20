// AI provider configuration.
// Supported providers: 'gemini', 'grok', 'groq', 'bedrock', and 'ollama'.
const AI_PROVIDERS = ['gemini', 'grok', 'groq', 'bedrock', 'ollama'];
const DEFAULT_AI_PROVIDER = 'bedrock';

const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
const DEFAULT_OLLAMA_MODEL = 'llama3.2';

// Gemini model configuration.
// The first model in this list is treated as the default model everywhere.
const GEMINI_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite-preview',
  'gemini-3.1-pro-preview'
];

// Grok / xAI model configuration.
// The first model in this list is treated as the default model everywhere.
const GROK_MODELS = [
  'grok-4.6',
  'grok-4.5',
  'grok-4.3'
];

// Groq model configuration.
// The first model in this list is treated as the default model everywhere.
const GROQ_MODELS = [
  'qwen/qwen3.6-27b',
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b'
];

// AWS Bedrock model configuration.
// Custom model IDs are allowed; the first entry is the default.
// Screenshot answers always send OCR from the latest screenshot only.
const BEDROCK_MODELS = [
  'qwen.qwen3-coder-30b-a3b-v1:0',
  'amazon.nova-lite-v1:0',
  'amazon.nova-pro-v1:0',
  'anthropic.claude-3-5-sonnet-20241022-v2:0'
];
const DEFAULT_BEDROCK_REGION = 'ap-south-1';

// AssemblyAI speech model configuration.
// The first model in this list is treated as the default model everywhere.
const ASSEMBLY_AI_SPEECH_MODELS = [
  'universal-streaming-english',
  'universal-streaming-multilingual'
];

// Programming language configuration.
// The first language in this list is treated as the default language everywhere.
const PROGRAMMING_LANGUAGES = [
  'Python',
  'Java',
  'JavaScript',
  'TypeScript',
  'C++',
  'Go',
  'Rust',
  'C#',
  'Kotlin'
];

// Keyboard shortcuts configuration.
// Edit accelerators here to customize app shortcuts in one place.
// Chord shortcuts: tap ` then a letter within 2s, or hold ` and press the letter.
const CHORD_MODIFIER_KEY = '`';

const KEYBOARD_SHORTCUTS = [
  {
    id: 'toggleTranscription',
    buttonLabel: 'Transcription',
    description: 'Toggle transcription master control',
    accelerator: 'Ctrl+Shift+T'
  },
  {
    id: 'takeScreenshot',
    buttonLabel: 'Screenshot',
    description: 'Tap ` then S within 2s (or hold ` and press S): screenshot',
    accelerator: '`+S'
  },
  {
    id: 'askAi',
    buttonLabel: 'Ask AI',
    description: 'Tap ` then A within 2s (or hold ` and press A): MCQ / aptitude answer',
    accelerator: '`+A'
  },
  {
    id: 'codingAi',
    buttonLabel: 'Code',
    description: 'Tap ` then C within 2s (or hold ` and press C): Python code only',
    accelerator: '`+C'
  },
  {
    id: 'screenAi',
    buttonLabel: 'Screen AI',
    description: 'Analyzes only enabled screenshots selected in chat',
    accelerator: 'Ctrl+Shift+E'
  },
  {
    id: 'suggest',
    buttonLabel: 'Suggest',
    description: 'Uses only enabled transcript context to suggest what to say next',
    accelerator: 'Ctrl+Shift+G'
  },
  {
    id: 'notes',
    buttonLabel: 'Notes',
    description: 'Generates notes from only enabled context',
    accelerator: 'Ctrl+Shift+N'
  },
  {
    id: 'insights',
    buttonLabel: 'Insights',
    description: 'Finds key insights from only enabled context',
    accelerator: 'Ctrl+Shift+I'
  },
  {
    id: 'clearChat',
    buttonLabel: 'Clear Chat',
    description: 'Clears chat, screenshots, and AI history',
    accelerator: 'Ctrl+Shift+Backspace'
  },
  {
    id: 'quitApp',
    buttonLabel: 'Quit',
    description: 'Quit the application',
    accelerator: 'Ctrl+Q'
  },
  {
    id: 'emergencyHide',
    buttonLabel: 'Hide',
    description: 'Tap ` then H: hide overlay. Tap ` then H again to show it.',
    accelerator: '`+H'
  },
  {
    id: 'toggleStealth',
    buttonLabel: 'Toggle Stealth',
    description: 'Toggle stealth mode',
    accelerator: 'Ctrl+Shift+H'
  },
  {
    id: 'moveWindowLeft',
    buttonLabel: 'Move Window Left',
    description: 'Tap ` then Left: move window left',
    accelerator: '`+Left'
  },
  {
    id: 'moveWindowRight',
    buttonLabel: 'Move Window Right',
    description: 'Tap ` then Right: move window right',
    accelerator: '`+Right'
  },
  {
    id: 'moveWindowUp',
    buttonLabel: 'Move Window Up',
    description: 'Tap ` then Up: move window to top',
    accelerator: '`+Up'
  },
  {
    id: 'moveWindowDown',
    buttonLabel: 'Move Window Down',
    description: 'Tap ` then Down: move window to bottom',
    accelerator: '`+Down'
  },
  {
    id: 'windowSizePreset1',
    buttonLabel: 'Size Preset 1',
    description: 'Resize window to minimum size',
    accelerator: 'Ctrl+Shift+1'
  },
  {
    id: 'windowSizePreset2',
    buttonLabel: 'Size Preset 2',
    description: 'Resize window to +25% from minimum size',
    accelerator: 'Ctrl+Shift+2'
  },
  {
    id: 'windowSizePreset3',
    buttonLabel: 'Size Preset 3',
    description: 'Resize window to +50% from minimum size',
    accelerator: 'Ctrl+Shift+3'
  },
  {
    id: 'windowSizePreset4',
    buttonLabel: 'Size Preset 4',
    description: 'Resize window to +75% from minimum size',
    accelerator: 'Ctrl+Shift+4'
  }
];

// AI provider configuration functions
function getAiProviders() {
  return [...AI_PROVIDERS];
}

function getDefaultAiProvider() {
  return DEFAULT_AI_PROVIDER;
}

function isConfiguredAiProvider(providerName) {
  return AI_PROVIDERS.includes(providerName);
}

function resolveAiProvider(providerName) {
  const normalizedProvider = String(providerName ?? '').trim().toLowerCase();
  if (isConfiguredAiProvider(normalizedProvider)) {
    return normalizedProvider;
  }

  return DEFAULT_AI_PROVIDER;
}

function hasApiKeyForAiProvider(provider, {
  bedrockApiKey = '',
  groqApiKey = '',
  grokApiKey = '',
  geminiApiKey = ''
} = {}) {
  const normalizedProvider = String(provider ?? '').trim().toLowerCase();

  if (normalizedProvider === 'ollama') {
    return true;
  }

  if (normalizedProvider === 'bedrock') {
    return String(bedrockApiKey ?? '').trim().length > 0;
  }

  if (normalizedProvider === 'groq') {
    return String(groqApiKey ?? '').trim().length > 0;
  }

  if (normalizedProvider === 'grok') {
    return String(grokApiKey ?? '').trim().length > 0;
  }

  if (normalizedProvider === 'gemini') {
    return String(geminiApiKey ?? '').trim().length > 0;
  }

  return false;
}

function inferAiProviderFromKeys({
  aiProvider = '',
  bedrockApiKey = '',
  groqApiKey = '',
  grokApiKey = '',
  geminiApiKey = ''
} = {}) {
  const keySnapshot = { bedrockApiKey, groqApiKey, grokApiKey, geminiApiKey };
  const normalizedProvider = String(aiProvider ?? '').trim().toLowerCase();
  if (
    isConfiguredAiProvider(normalizedProvider) &&
    hasApiKeyForAiProvider(normalizedProvider, keySnapshot)
  ) {
    return normalizedProvider;
  }

  const hasBedrockKey = String(bedrockApiKey ?? '').trim().length > 0;
  const hasGroqKey = String(groqApiKey ?? '').trim().length > 0;
  const hasGrokKey = String(grokApiKey ?? '').trim().length > 0;
  const hasGeminiKey = String(geminiApiKey ?? '').trim().length > 0;

  if (hasBedrockKey) {
    return 'bedrock';
  }
  if (hasGroqKey) {
    return 'groq';
  }
  if (hasGrokKey) {
    return 'grok';
  }
  if (hasGeminiKey) {
    return 'gemini';
  }

  return DEFAULT_AI_PROVIDER;
}

function getDefaultOllamaBaseUrl() {
  return DEFAULT_OLLAMA_BASE_URL;
}

function getDefaultOllamaModel() {
  return DEFAULT_OLLAMA_MODEL;
}

// Gemini model configuration functions
function getGeminiModels() {
  if (!Array.isArray(GEMINI_MODELS) || GEMINI_MODELS.length === 0) {
    throw new Error('Gemini models are not configured. Add at least one model to src/config.js.');
  }

  return [...GEMINI_MODELS];
}

function getDefaultGeminiModel() {
  return getGeminiModels()[0];
}

function isConfiguredGeminiModel(modelName) {
  return getGeminiModels().includes(modelName);
}

function resolveGeminiModel(modelName) {
  return isConfiguredGeminiModel(modelName) ? modelName : getDefaultGeminiModel();
}

// Grok model configuration functions
function getGrokModels() {
  if (!Array.isArray(GROK_MODELS) || GROK_MODELS.length === 0) {
    throw new Error('Grok models are not configured. Add at least one model to src/config.js.');
  }

  return [...GROK_MODELS];
}

function getDefaultGrokModel() {
  return getGrokModels()[0];
}

function isConfiguredGrokModel(modelName) {
  return getGrokModels().includes(modelName);
}

function resolveGrokModel(modelName) {
  return isConfiguredGrokModel(modelName) ? modelName : getDefaultGrokModel();
}

// Groq model configuration functions
function getGroqModels() {
  if (!Array.isArray(GROQ_MODELS) || GROQ_MODELS.length === 0) {
    throw new Error('Groq models are not configured. Add at least one model to src/config.js.');
  }

  return [...GROQ_MODELS];
}

function getDefaultGroqModel() {
  return getGroqModels()[0];
}

function isConfiguredGroqModel(modelName) {
  return getGroqModels().includes(modelName);
}

function resolveGroqModel(modelName) {
  return isConfiguredGroqModel(modelName) ? modelName : getDefaultGroqModel();
}

// Bedrock model / region configuration functions
function getBedrockModels() {
  if (!Array.isArray(BEDROCK_MODELS) || BEDROCK_MODELS.length === 0) {
    throw new Error('Bedrock models are not configured. Add at least one model to src/config.js.');
  }

  return [...BEDROCK_MODELS];
}

function getDefaultBedrockModel() {
  return getBedrockModels()[0];
}

function getDefaultBedrockRegion() {
  return DEFAULT_BEDROCK_REGION;
}

function resolveBedrockModel(modelName) {
  const nextModel = String(modelName || '').trim();
  return nextModel || getDefaultBedrockModel();
}

function resolveBedrockRegion(regionName) {
  const nextRegion = String(regionName || '').trim();
  return nextRegion || getDefaultBedrockRegion();
}

// Programming language configuration functions
function getProgrammingLanguages() {
  if (!Array.isArray(PROGRAMMING_LANGUAGES) || PROGRAMMING_LANGUAGES.length === 0) {
    throw new Error('Programming languages are not configured. Add at least one language to src/config.js.');
  }

  return [...PROGRAMMING_LANGUAGES];
}

function getDefaultProgrammingLanguage() {
  return getProgrammingLanguages()[0];
}

function isConfiguredProgrammingLanguage(languageName) {
  return getProgrammingLanguages().includes(languageName);
}

function resolveProgrammingLanguage(languageName) {
  return isConfiguredProgrammingLanguage(languageName)
    ? languageName
    : getDefaultProgrammingLanguage();
}

// AssemblyAI speech model configuration functions
function getAssemblyAiSpeechModels() {
  if (!Array.isArray(ASSEMBLY_AI_SPEECH_MODELS) || ASSEMBLY_AI_SPEECH_MODELS.length === 0) {
    throw new Error('AssemblyAI speech models are not configured. Add at least one model to src/config.js.');
  }

  return [...ASSEMBLY_AI_SPEECH_MODELS];
}

function getDefaultAssemblyAiSpeechModel() {
  return getAssemblyAiSpeechModels()[0];
}

function isConfiguredAssemblyAiSpeechModel(modelName) {
  return getAssemblyAiSpeechModels().includes(modelName);
}

function resolveAssemblyAiSpeechModel(modelName, fallbackModel = getDefaultAssemblyAiSpeechModel()) {
  if (isConfiguredAssemblyAiSpeechModel(modelName)) {
    return modelName;
  }

  if (isConfiguredAssemblyAiSpeechModel(fallbackModel)) {
    return fallbackModel;
  }

  return getDefaultAssemblyAiSpeechModel();
}

function getKeyboardShortcuts() {
  if (!Array.isArray(KEYBOARD_SHORTCUTS) || KEYBOARD_SHORTCUTS.length === 0) {
    throw new Error('Keyboard shortcuts are not configured. Add at least one shortcut to src/config.js.');
  }

  return KEYBOARD_SHORTCUTS.map((shortcut) => ({ ...shortcut }));
}

function getKeyboardShortcutById(shortcutId) {
  const normalizedId = String(shortcutId || '').trim();
  if (!normalizedId) {
    throw new Error('Shortcut id is required.');
  }

  const shortcut = getKeyboardShortcuts().find((entry) => entry.id === normalizedId);
  if (!shortcut) {
    throw new Error(`Shortcut "${normalizedId}" is not configured in src/config.js.`);
  }

  return shortcut;
}

function getKeyboardShortcutAccelerator(shortcutId) {
  const shortcut = getKeyboardShortcutById(shortcutId);
  const accelerator = String(shortcut.accelerator || '').trim();
  if (!accelerator) {
    throw new Error(`Shortcut "${shortcutId}" is missing an accelerator in src/config.js.`);
  }

  return accelerator;
}

function shortcutAcceleratorUsesZeroPrefix(shortcutId) {
  const tokens = getZeroPrefixTokens(getKeyboardShortcutAccelerator(shortcutId));
  return tokens.length >= 2 && tokens[0] === CHORD_MODIFIER_KEY;
}

function getZeroPrefixTokens(accelerator) {
  return String(accelerator || '')
    .split('+')
    .map((token) => token.trim())
    .filter(Boolean);
}

function getZeroChordKeyFromAccelerator(accelerator) {
  const tokens = getZeroPrefixTokens(accelerator);
  if (tokens.length < 2 || tokens[0] !== CHORD_MODIFIER_KEY) {
    return '';
  }

  const keyToken = tokens[tokens.length - 1];
  if (!keyToken || keyToken === CHORD_MODIFIER_KEY) {
    return '';
  }

  const normalized = keyToken.toLowerCase();
  const arrowAliases = {
    left: 'left',
    right: 'right',
    up: 'up',
    down: 'down',
    arrowleft: 'left',
    arrowright: 'right',
    arrowup: 'up',
    arrowdown: 'down'
  };

  if (Object.prototype.hasOwnProperty.call(arrowAliases, normalized)) {
    return arrowAliases[normalized];
  }

  return normalized;
}

module.exports = {
  getAiProviders,
  getDefaultAiProvider,
  getDefaultOllamaBaseUrl,
  getDefaultOllamaModel,
  isConfiguredAiProvider,
  resolveAiProvider,
  inferAiProviderFromKeys,
  getAssemblyAiSpeechModels,
  getDefaultAssemblyAiSpeechModel,
  getGeminiModels,
  getDefaultGeminiModel,
  getGrokModels,
  getDefaultGrokModel,
  getGroqModels,
  getDefaultGroqModel,
  getBedrockModels,
  getDefaultBedrockModel,
  getDefaultBedrockRegion,
  CHORD_MODIFIER_KEY,
  getZeroChordKeyFromAccelerator,
  getZeroPrefixTokens,
  getKeyboardShortcutAccelerator,
  getKeyboardShortcutById,
  getKeyboardShortcuts,
  hasApiKeyForAiProvider,
  shortcutAcceleratorUsesZeroPrefix,
  getDefaultProgrammingLanguage,
  getProgrammingLanguages,
  isConfiguredAssemblyAiSpeechModel,
  isConfiguredGeminiModel,
  isConfiguredGrokModel,
  isConfiguredGroqModel,
  isConfiguredProgrammingLanguage,
  resolveAssemblyAiSpeechModel,
  resolveGeminiModel,
  resolveGrokModel,
  resolveGroqModel,
  resolveBedrockModel,
  resolveBedrockRegion,
  resolveProgrammingLanguage
};
