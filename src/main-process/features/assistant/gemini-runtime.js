const GeminiService = require('../../../services/ai/gemini-service');
const GrokService = require('../../../services/ai/grok-service');
const GroqService = require('../../../services/ai/groq-service');
const BedrockService = require('../../../services/ai/bedrock-service');
const OllamaService = require('../../../services/ai/ollama-service');
const {
  resolveAiProvider,
  getAiProviders,
  getDefaultAiProvider,
  getDefaultOllamaBaseUrl,
  getDefaultOllamaModel,
  resolveGeminiModel,
  resolveGrokModel,
  resolveGroqModel,
  resolveBedrockModel,
  resolveBedrockRegion,
  resolveProgrammingLanguage,
  getGeminiModels,
  getDefaultGeminiModel,
  getGrokModels,
  getDefaultGrokModel,
  getGroqModels,
  getDefaultGroqModel,
  getBedrockModels,
  getDefaultBedrockModel,
  getDefaultBedrockRegion,
  getProgrammingLanguages,
  getDefaultProgrammingLanguage
} = require('../../../config');

const GEMINI_ALL_KEYS_UNAVAILABLE_ERROR_CODE = 'GEMINI_ALL_KEYS_UNAVAILABLE';
const GROK_ALL_KEYS_UNAVAILABLE_ERROR_CODE = 'GROK_ALL_KEYS_UNAVAILABLE';
const GROQ_ALL_KEYS_UNAVAILABLE_ERROR_CODE = 'GROQ_ALL_KEYS_UNAVAILABLE';
const BEDROCK_ALL_KEYS_UNAVAILABLE_ERROR_CODE = 'BEDROCK_ALL_KEYS_UNAVAILABLE';

function normalizeGeminiApiKeys(keys) {
  const sourceValues = Array.isArray(keys)
    ? keys
    : String(keys ?? '').split(',');
  const seen = new Set();
  const nextKeys = [];

  for (const rawValue of sourceValues) {
    const key = String(rawValue || '').trim();
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    nextKeys.push(key);
  }

  return nextKeys;
}

function createGeminiRuntime() {
  let geminiService = null;
  let grokService = null;
  let groqService = null;
  let bedrockService = null;
  let ollamaService = null;
  let activeAiProvider = getDefaultAiProvider();
  let activeGeminiModel = getDefaultGeminiModel();
  let activeGrokModel = getDefaultGrokModel();
  let activeGroqModel = getDefaultGroqModel();
  let activeBedrockModel = getDefaultBedrockModel();
  let activeBedrockRegion = getDefaultBedrockRegion();
  let activeProgrammingLanguage = getDefaultProgrammingLanguage();
  let activeOllamaBaseUrl = getDefaultOllamaBaseUrl();
  let activeOllamaModel = getDefaultOllamaModel();
  let geminiApiKeys = [];
  let grokApiKeys = [];
  let groqApiKeys = [];
  let bedrockApiKeys = [];
  let activeApiKeyIndex = 0;
  let activeGrokApiKeyIndex = 0;
  let activeGroqApiKeyIndex = 0;
  let activeBedrockApiKeyIndex = 0;
  let activeKeyIndexChangeHandler = null;
  let activeGrokKeyIndexChangeHandler = null;
  let activeGroqKeyIndexChangeHandler = null;
  let activeBedrockKeyIndexChangeHandler = null;

  function notifyActiveKeyIndexChanged(index) {
    if (typeof activeKeyIndexChangeHandler !== 'function') {
      return;
    }

    try {
      activeKeyIndexChangeHandler(index);
    } catch (error) {
      console.error('Failed to persist active Gemini API key index:', error);
    }
  }

  function notifyActiveGrokKeyIndexChanged(index) {
    if (typeof activeGrokKeyIndexChangeHandler !== 'function') {
      return;
    }

    try {
      activeGrokKeyIndexChangeHandler(index);
    } catch (error) {
      console.error('Failed to persist active Grok API key index:', error);
    }
  }

  function notifyActiveGroqKeyIndexChanged(index) {
    if (typeof activeGroqKeyIndexChangeHandler !== 'function') {
      return;
    }

    try {
      activeGroqKeyIndexChangeHandler(index);
    } catch (error) {
      console.error('Failed to persist active Groq API key index:', error);
    }
  }

  function notifyActiveBedrockKeyIndexChanged(index) {
    if (typeof activeBedrockKeyIndexChangeHandler !== 'function') {
      return;
    }

    try {
      activeBedrockKeyIndexChangeHandler(index);
    } catch (error) {
      console.error('Failed to persist active Bedrock API key index:', error);
    }
  }

  function normalizeKeyIndex(index) {
    if (geminiApiKeys.length === 0) {
      return 0;
    }

    const parsedIndex = Number.parseInt(String(index ?? ''), 10);
    const safeIndex = Number.isFinite(parsedIndex) ? parsedIndex : 0;
    const maxIndex = geminiApiKeys.length - 1;

    return Math.min(Math.max(safeIndex, 0), maxIndex);
  }

  function setActiveApiKeyIndex(index, options = {}) {
    const nextIndex = normalizeKeyIndex(index);
    const shouldNotify = options.notify !== false;
    const changed = nextIndex !== activeApiKeyIndex;
    activeApiKeyIndex = nextIndex;

    if (changed && shouldNotify) {
      notifyActiveKeyIndexChanged(activeApiKeyIndex);
    }

    return activeApiKeyIndex;
  }

  function getActiveApiKey() {
    if (geminiApiKeys.length === 0) {
      return '';
    }

    return geminiApiKeys[activeApiKeyIndex] || '';
  }

  function hasApiKeys() {
    return geminiApiKeys.length > 0;
  }

  function initializeGeminiService(
    apiKey = getActiveApiKey(),
    modelName = activeGeminiModel,
    programmingLanguage = activeProgrammingLanguage
  ) {
    activeGeminiModel = resolveGeminiModel(modelName);
    activeProgrammingLanguage = resolveProgrammingLanguage(programmingLanguage);

    try {
      if (!apiKey) {
        console.error('Gemini API key not configured in app settings');
        geminiService = null;
        return null;
      }

      console.log(
        'Initializing Gemini AI Service with model and language:',
        activeGeminiModel,
        activeProgrammingLanguage
      );

      if (geminiService) {
        geminiService.updateConfiguration({
          apiKey,
          modelName: activeGeminiModel,
          programmingLanguage: activeProgrammingLanguage
        });
      } else {
        geminiService = new GeminiService(apiKey, {
          modelName: activeGeminiModel,
          programmingLanguage: activeProgrammingLanguage
        });
      }

      console.log('Gemini AI Service initialized successfully');
      return geminiService;
    } catch (error) {
      geminiService = null;
      console.error('Failed to initialize Gemini AI Service:', error);
      return null;
    }
  }

  function setKeys(apiKeys, preferredIndex = 0) {
    geminiApiKeys = normalizeGeminiApiKeys(apiKeys);

    if (!hasApiKeys()) {
      setActiveApiKeyIndex(0);
      geminiService = null;
      return {
        geminiApiKeys: [],
        activeApiKeyIndex: 0,
        activeApiKey: ''
      };
    }

    setActiveApiKeyIndex(preferredIndex);

    return {
      geminiApiKeys: [...geminiApiKeys],
      activeApiKeyIndex,
      activeApiKey: getActiveApiKey()
    };
  }

  function getApiKeys() {
    return [...geminiApiKeys];
  }

  function switchToNextKey() {
    if (!hasApiKeys()) {
      return {
        switched: false,
        activeApiKeyIndex,
        activeApiKey: ''
      };
    }

    if (geminiApiKeys.length === 1) {
      return {
        switched: false,
        activeApiKeyIndex,
        activeApiKey: getActiveApiKey()
      };
    }

    const previousIndex = activeApiKeyIndex;
    const nextIndex = (activeApiKeyIndex + 1) % geminiApiKeys.length;
    setActiveApiKeyIndex(nextIndex);

    if (nextIndex === previousIndex) {
      return {
        switched: false,
        activeApiKeyIndex,
        activeApiKey: getActiveApiKey()
      };
    }

    initializeGeminiService(getActiveApiKey(), activeGeminiModel, activeProgrammingLanguage);

    return {
      switched: true,
      activeApiKeyIndex,
      activeApiKey: getActiveApiKey()
    };
  }

  function normalizeGrokKeyIndex(index) {
    if (grokApiKeys.length === 0) {
      return 0;
    }

    const parsedIndex = Number.parseInt(String(index ?? ''), 10);
    const safeIndex = Number.isFinite(parsedIndex) ? parsedIndex : 0;
    const maxIndex = grokApiKeys.length - 1;

    return Math.min(Math.max(safeIndex, 0), maxIndex);
  }

  function setActiveGrokApiKeyIndex(index, options = {}) {
    const nextIndex = normalizeGrokKeyIndex(index);
    const shouldNotify = options.notify !== false;
    const changed = nextIndex !== activeGrokApiKeyIndex;
    activeGrokApiKeyIndex = nextIndex;

    if (changed && shouldNotify) {
      notifyActiveGrokKeyIndexChanged(activeGrokApiKeyIndex);
    }

    return activeGrokApiKeyIndex;
  }

  function getActiveGrokApiKey() {
    if (grokApiKeys.length === 0) {
      return '';
    }

    return grokApiKeys[activeGrokApiKeyIndex] || '';
  }

  function hasGrokApiKeys() {
    return grokApiKeys.length > 0;
  }

  function initializeGrokService(
    apiKey = getActiveGrokApiKey(),
    modelName = activeGrokModel,
    programmingLanguage = activeProgrammingLanguage
  ) {
    activeGrokModel = resolveGrokModel(modelName);
    activeProgrammingLanguage = resolveProgrammingLanguage(programmingLanguage);

    try {
      if (!apiKey) {
        console.error('Grok API key not configured in app settings');
        grokService = null;
        return null;
      }

      console.log(
        'Initializing Grok AI Service with model and language:',
        activeGrokModel,
        activeProgrammingLanguage
      );

      if (grokService) {
        grokService.updateConfiguration({
          apiKey,
          modelName: activeGrokModel,
          programmingLanguage: activeProgrammingLanguage
        });
      } else {
        grokService = new GrokService(apiKey, {
          modelName: activeGrokModel,
          programmingLanguage: activeProgrammingLanguage
        });
      }

      console.log('Grok AI Service initialized successfully');
      return grokService;
    } catch (error) {
      grokService = null;
      console.error('Failed to initialize Grok AI Service:', error);
      return null;
    }
  }

  function setGrokKeys(apiKeys, preferredIndex = 0) {
    grokApiKeys = normalizeGeminiApiKeys(apiKeys);

    if (!hasGrokApiKeys()) {
      setActiveGrokApiKeyIndex(0);
      grokService = null;
      return {
        grokApiKeys: [],
        activeGrokApiKeyIndex: 0,
        activeGrokApiKey: ''
      };
    }

    setActiveGrokApiKeyIndex(preferredIndex);

    return {
      grokApiKeys: [...grokApiKeys],
      activeGrokApiKeyIndex,
      activeGrokApiKey: getActiveGrokApiKey()
    };
  }

  function getGrokApiKeys() {
    return [...grokApiKeys];
  }

  function switchToNextGrokKey() {
    if (!hasGrokApiKeys()) {
      return {
        switched: false,
        activeGrokApiKeyIndex,
        activeGrokApiKey: ''
      };
    }

    if (grokApiKeys.length === 1) {
      return {
        switched: false,
        activeGrokApiKeyIndex,
        activeGrokApiKey: getActiveGrokApiKey()
      };
    }

    const previousIndex = activeGrokApiKeyIndex;
    const nextIndex = (activeGrokApiKeyIndex + 1) % grokApiKeys.length;
    setActiveGrokApiKeyIndex(nextIndex);

    if (nextIndex === previousIndex) {
      return {
        switched: false,
        activeGrokApiKeyIndex,
        activeGrokApiKey: getActiveGrokApiKey()
      };
    }

    initializeGrokService(getActiveGrokApiKey(), activeGrokModel, activeProgrammingLanguage);

    return {
      switched: true,
      activeGrokApiKeyIndex,
      activeGrokApiKey: getActiveGrokApiKey()
    };
  }

  function normalizeGroqKeyIndex(index) {
    if (groqApiKeys.length === 0) {
      return 0;
    }

    const parsedIndex = Number.parseInt(String(index ?? ''), 10);
    const safeIndex = Number.isFinite(parsedIndex) ? parsedIndex : 0;
    const maxIndex = groqApiKeys.length - 1;

    return Math.min(Math.max(safeIndex, 0), maxIndex);
  }

  function setActiveGroqApiKeyIndex(index, options = {}) {
    const nextIndex = normalizeGroqKeyIndex(index);
    const shouldNotify = options.notify !== false;
    const changed = nextIndex !== activeGroqApiKeyIndex;
    activeGroqApiKeyIndex = nextIndex;

    if (changed && shouldNotify) {
      notifyActiveGroqKeyIndexChanged(activeGroqApiKeyIndex);
    }

    return activeGroqApiKeyIndex;
  }

  function getActiveGroqApiKey() {
    if (groqApiKeys.length === 0) {
      return '';
    }

    return groqApiKeys[activeGroqApiKeyIndex] || '';
  }

  function hasGroqApiKeys() {
    return groqApiKeys.length > 0;
  }

  function initializeGroqService(
    apiKey = getActiveGroqApiKey(),
    modelName = activeGroqModel,
    programmingLanguage = activeProgrammingLanguage
  ) {
    activeGroqModel = resolveGroqModel(modelName);
    activeProgrammingLanguage = resolveProgrammingLanguage(programmingLanguage);

    try {
      if (!apiKey) {
        console.error('Groq API key not configured in app settings');
        groqService = null;
        return null;
      }

      console.log(
        'Initializing Groq AI Service with model and language:',
        activeGroqModel,
        activeProgrammingLanguage
      );

      if (groqService) {
        groqService.updateConfiguration({
          apiKey,
          modelName: activeGroqModel,
          programmingLanguage: activeProgrammingLanguage
        });
      } else {
        groqService = new GroqService(apiKey, {
          modelName: activeGroqModel,
          programmingLanguage: activeProgrammingLanguage
        });
      }

      console.log('Groq AI Service initialized successfully');
      return groqService;
    } catch (error) {
      groqService = null;
      console.error('Failed to initialize Groq AI Service:', error);
      return null;
    }
  }

  function setGroqKeys(apiKeys, preferredIndex = 0) {
    groqApiKeys = normalizeGeminiApiKeys(apiKeys);

    if (!hasGroqApiKeys()) {
      setActiveGroqApiKeyIndex(0);
      groqService = null;
      return {
        groqApiKeys: [],
        activeGroqApiKeyIndex: 0,
        activeGroqApiKey: ''
      };
    }

    setActiveGroqApiKeyIndex(preferredIndex);

    return {
      groqApiKeys: [...groqApiKeys],
      activeGroqApiKeyIndex,
      activeGroqApiKey: getActiveGroqApiKey()
    };
  }

  function getGroqApiKeys() {
    return [...groqApiKeys];
  }

  function switchToNextGroqKey() {
    if (!hasGroqApiKeys()) {
      return {
        switched: false,
        activeGroqApiKeyIndex,
        activeGroqApiKey: ''
      };
    }

    if (groqApiKeys.length === 1) {
      return {
        switched: false,
        activeGroqApiKeyIndex,
        activeGroqApiKey: getActiveGroqApiKey()
      };
    }

    const previousIndex = activeGroqApiKeyIndex;
    const nextIndex = (activeGroqApiKeyIndex + 1) % groqApiKeys.length;
    setActiveGroqApiKeyIndex(nextIndex);

    if (nextIndex === previousIndex) {
      return {
        switched: false,
        activeGroqApiKeyIndex,
        activeGroqApiKey: getActiveGroqApiKey()
      };
    }

    initializeGroqService(getActiveGroqApiKey(), activeGroqModel, activeProgrammingLanguage);

    return {
      switched: true,
      activeGroqApiKeyIndex,
      activeGroqApiKey: getActiveGroqApiKey()
    };
  }

  function normalizeBedrockKeyIndex(index) {
    if (bedrockApiKeys.length === 0) {
      return 0;
    }

    const parsedIndex = Number.parseInt(String(index ?? ''), 10);
    const safeIndex = Number.isFinite(parsedIndex) ? parsedIndex : 0;
    const maxIndex = bedrockApiKeys.length - 1;

    return Math.min(Math.max(safeIndex, 0), maxIndex);
  }

  function setActiveBedrockApiKeyIndex(index, options = {}) {
    const nextIndex = normalizeBedrockKeyIndex(index);
    const shouldNotify = options.notify !== false;
    const changed = nextIndex !== activeBedrockApiKeyIndex;
    activeBedrockApiKeyIndex = nextIndex;

    if (changed && shouldNotify) {
      notifyActiveBedrockKeyIndexChanged(activeBedrockApiKeyIndex);
    }

    return activeBedrockApiKeyIndex;
  }

  function getActiveBedrockApiKey() {
    if (bedrockApiKeys.length === 0) {
      return '';
    }

    return bedrockApiKeys[activeBedrockApiKeyIndex] || '';
  }

  function hasBedrockApiKeys() {
    return bedrockApiKeys.length > 0;
  }

  function initializeBedrockService(
    apiKey = getActiveBedrockApiKey(),
    modelName = activeBedrockModel,
    programmingLanguage = activeProgrammingLanguage,
    region = activeBedrockRegion
  ) {
    activeBedrockModel = resolveBedrockModel(modelName);
    activeBedrockRegion = resolveBedrockRegion(region);
    activeProgrammingLanguage = resolveProgrammingLanguage(programmingLanguage);

    try {
      if (!apiKey) {
        console.error('Bedrock API key not configured in app settings');
        bedrockService = null;
        return null;
      }

      console.log(
        'Initializing Bedrock AI Service with model, region, and language:',
        activeBedrockModel,
        activeBedrockRegion,
        activeProgrammingLanguage
      );

      if (bedrockService) {
        bedrockService.updateConfiguration({
          apiKey,
          modelName: activeBedrockModel,
          region: activeBedrockRegion,
          programmingLanguage: activeProgrammingLanguage
        });
      } else {
        bedrockService = new BedrockService(apiKey, {
          modelName: activeBedrockModel,
          region: activeBedrockRegion,
          programmingLanguage: activeProgrammingLanguage
        });
      }

      console.log('Bedrock AI Service initialized successfully');
      return bedrockService;
    } catch (error) {
      bedrockService = null;
      console.error('Failed to initialize Bedrock AI Service:', error);
      return null;
    }
  }

  function setBedrockKeys(apiKeys, preferredIndex = 0) {
    bedrockApiKeys = normalizeGeminiApiKeys(apiKeys);

    if (!hasBedrockApiKeys()) {
      setActiveBedrockApiKeyIndex(0);
      bedrockService = null;
      return {
        bedrockApiKeys: [],
        activeBedrockApiKeyIndex: 0,
        activeBedrockApiKey: ''
      };
    }

    setActiveBedrockApiKeyIndex(preferredIndex);

    return {
      bedrockApiKeys: [...bedrockApiKeys],
      activeBedrockApiKeyIndex,
      activeBedrockApiKey: getActiveBedrockApiKey()
    };
  }

  function getBedrockApiKeys() {
    return [...bedrockApiKeys];
  }

  function switchToNextBedrockKey() {
    if (!hasBedrockApiKeys()) {
      return {
        switched: false,
        activeBedrockApiKeyIndex,
        activeBedrockApiKey: ''
      };
    }

    if (bedrockApiKeys.length === 1) {
      return {
        switched: false,
        activeBedrockApiKeyIndex,
        activeBedrockApiKey: getActiveBedrockApiKey()
      };
    }

    const previousIndex = activeBedrockApiKeyIndex;
    const nextIndex = (activeBedrockApiKeyIndex + 1) % bedrockApiKeys.length;
    setActiveBedrockApiKeyIndex(nextIndex);

    if (nextIndex === previousIndex) {
      return {
        switched: false,
        activeBedrockApiKeyIndex,
        activeBedrockApiKey: getActiveBedrockApiKey()
      };
    }

    initializeBedrockService(
      getActiveBedrockApiKey(),
      activeBedrockModel,
      activeProgrammingLanguage,
      activeBedrockRegion
    );

    return {
      switched: true,
      activeBedrockApiKeyIndex,
      activeBedrockApiKey: getActiveBedrockApiKey()
    };
  }

  function isAiConfigured() {
    if (activeAiProvider === 'ollama') {
      return true;
    }

    if (activeAiProvider === 'grok') {
      return hasGrokApiKeys();
    }

    if (activeAiProvider === 'groq') {
      return hasGroqApiKeys();
    }

    if (activeAiProvider === 'bedrock') {
      return hasBedrockApiKeys();
    }

    return hasApiKeys();
  }

  function getMissingApiKeyError() {
    if (activeAiProvider === 'grok') {
      return new Error('No Grok API key configured. Add it in Settings.');
    }

    if (activeAiProvider === 'groq') {
      return new Error('No Groq API key configured. Add it in Settings.');
    }

    if (activeAiProvider === 'bedrock') {
      return new Error('No Bedrock API key configured. Add it in Settings.');
    }

    if (activeAiProvider === 'ollama') {
      return new Error('Ollama service not available. Check that Ollama is running.');
    }

    return new Error('No Gemini API key configured. Add it in Settings.');
  }

  function isSwitchEligibleError(error) {
    if (!error) {
      return false;
    }

    if (geminiService?.isQuotaExhaustedError?.(error) || grokService?.isQuotaExhaustedError?.(error) || groqService?.isQuotaExhaustedError?.(error) || bedrockService?.isQuotaExhaustedError?.(error)) {
      return true;
    }

    if (geminiService?.isAuthenticationError?.(error) || grokService?.isAuthenticationError?.(error) || groqService?.isAuthenticationError?.(error) || bedrockService?.isAuthenticationError?.(error)) {
      return true;
    }

    const message = String(error?.message || '').toLowerCase();
    return (
      message.includes('quota exceeded') ||
      message.includes('api key not valid') ||
      message.includes('invalid api key') ||
      message.includes('permission denied') ||
      message.includes('401') ||
      message.includes('403') ||
      message.includes('unauthorized') ||
      message.includes('forbidden')
    );
  }

  function createAllKeysUnavailableError(cause, providerName = 'Gemini') {
    const allKeysUnavailableError = new Error(
      `All configured ${providerName} API keys are currently unavailable due to quota or authentication errors.`
    );

    allKeysUnavailableError.code = providerName === 'Grok'
      ? GROK_ALL_KEYS_UNAVAILABLE_ERROR_CODE
      : providerName === 'Groq'
        ? GROQ_ALL_KEYS_UNAVAILABLE_ERROR_CODE
        : providerName === 'Bedrock'
          ? BEDROCK_ALL_KEYS_UNAVAILABLE_ERROR_CODE
          : GEMINI_ALL_KEYS_UNAVAILABLE_ERROR_CODE;
    allKeysUnavailableError.isAllKeysUnavailable = true;
    if (cause) {
      allKeysUnavailableError.cause = cause;
    }

    return allKeysUnavailableError;
  }

  function isAllKeysUnavailableError(error) {
    return Boolean(
      error && (
        error.code === GEMINI_ALL_KEYS_UNAVAILABLE_ERROR_CODE ||
        error.code === GROK_ALL_KEYS_UNAVAILABLE_ERROR_CODE ||
        error.code === GROQ_ALL_KEYS_UNAVAILABLE_ERROR_CODE ||
        error.code === BEDROCK_ALL_KEYS_UNAVAILABLE_ERROR_CODE ||
        error.isAllKeysUnavailable === true
      )
    );
  }

  async function executeKeyedFailover({
    providerLabel,
    hasKeys,
    getActiveKey,
    getActiveIndex,
    getTotalKeys,
    initializeService,
    getService,
    switchToNext,
    restoreIndex,
    operation
  }) {
    if (!hasKeys()) {
      throw new Error(`No ${providerLabel} API key configured. Add it in Settings.`);
    }

    const totalKeys = getTotalKeys();
    const startIndex = getActiveIndex();
    let attemptedKeys = 0;
    let lastSwitchEligibleError = null;

    while (attemptedKeys < totalKeys) {
      const activeApiKey = getActiveKey();
      if (!activeApiKey) {
        break;
      }

      const service = getService();
      if (!service || service.apiKey !== activeApiKey) {
        initializeService(activeApiKey);
      }

      try {
        return await operation(getService(), {
          activeApiKeyIndex: getActiveIndex(),
          activeApiKey,
          attempt: attemptedKeys + 1,
          totalKeys
        });
      } catch (error) {
        if (!isSwitchEligibleError(error)) {
          throw error;
        }

        lastSwitchEligibleError = error;
        attemptedKeys += 1;

        if (attemptedKeys >= totalKeys) {
          if (getActiveIndex() !== startIndex) {
            restoreIndex(startIndex);
            initializeService(getActiveKey());
          }

          throw createAllKeysUnavailableError(lastSwitchEligibleError, providerLabel);
        }

        switchToNext();
      }
    }

    throw createAllKeysUnavailableError(lastSwitchEligibleError, providerLabel);
  }

  async function executeWithKeyFailover(operation) {
    if (typeof operation !== 'function') {
      throw new Error('AI failover operation must be a function.');
    }

    if (activeAiProvider === 'ollama') {
      if (!ollamaService) {
        initializeOllamaService();
      }
      if (!ollamaService) {
        throw new Error('Ollama service not available. Check that Ollama is running.');
      }
      return await operation(ollamaService, {
        activeApiKeyIndex: 0,
        activeApiKey: '',
        attempt: 1,
        totalKeys: 0
      });
    }

    if (activeAiProvider === 'grok') {
      return executeKeyedFailover({
        providerLabel: 'Grok',
        hasKeys: hasGrokApiKeys,
        getActiveKey: getActiveGrokApiKey,
        getActiveIndex: () => activeGrokApiKeyIndex,
        getTotalKeys: () => grokApiKeys.length,
        initializeService: (apiKey) => initializeGrokService(apiKey, activeGrokModel, activeProgrammingLanguage),
        getService: () => grokService,
        switchToNext: switchToNextGrokKey,
        restoreIndex: (index) => setActiveGrokApiKeyIndex(index),
        operation
      });
    }

    if (activeAiProvider === 'groq') {
      return executeKeyedFailover({
        providerLabel: 'Groq',
        hasKeys: hasGroqApiKeys,
        getActiveKey: getActiveGroqApiKey,
        getActiveIndex: () => activeGroqApiKeyIndex,
        getTotalKeys: () => groqApiKeys.length,
        initializeService: (apiKey) => initializeGroqService(apiKey, activeGroqModel, activeProgrammingLanguage),
        getService: () => groqService,
        switchToNext: switchToNextGroqKey,
        restoreIndex: (index) => setActiveGroqApiKeyIndex(index),
        operation
      });
    }

    if (activeAiProvider === 'bedrock') {
      return executeKeyedFailover({
        providerLabel: 'Bedrock',
        hasKeys: hasBedrockApiKeys,
        getActiveKey: getActiveBedrockApiKey,
        getActiveIndex: () => activeBedrockApiKeyIndex,
        getTotalKeys: () => bedrockApiKeys.length,
        initializeService: (apiKey) => initializeBedrockService(
          apiKey,
          activeBedrockModel,
          activeProgrammingLanguage,
          activeBedrockRegion
        ),
        getService: () => bedrockService,
        switchToNext: switchToNextBedrockKey,
        restoreIndex: (index) => setActiveBedrockApiKeyIndex(index),
        operation
      });
    }

    return executeKeyedFailover({
      providerLabel: 'Gemini',
      hasKeys,
      getActiveKey: getActiveApiKey,
      getActiveIndex: () => activeApiKeyIndex,
      getTotalKeys: () => geminiApiKeys.length,
      initializeService: (apiKey) => initializeGeminiService(apiKey, activeGeminiModel, activeProgrammingLanguage),
      getService: () => geminiService,
      switchToNext: switchToNextKey,
      restoreIndex: (index) => setActiveApiKeyIndex(index),
      operation
    });
  }

  function initializeOllamaService(
    baseUrl = activeOllamaBaseUrl,
    modelName = activeOllamaModel,
    programmingLanguage = activeProgrammingLanguage
  ) {
    activeOllamaBaseUrl = String(baseUrl || getDefaultOllamaBaseUrl()).replace(/\/+$/, '');
    activeOllamaModel = String(modelName || getDefaultOllamaModel()).trim();
    activeProgrammingLanguage = resolveProgrammingLanguage(programmingLanguage);

    try {
      console.log(
        'Initializing Ollama AI Service with model and language:',
        activeOllamaModel,
        activeProgrammingLanguage
      );

      if (ollamaService) {
        ollamaService.updateConfiguration({
          baseUrl: activeOllamaBaseUrl,
          modelName: activeOllamaModel,
          programmingLanguage: activeProgrammingLanguage
        });
      } else {
        ollamaService = new OllamaService({
          baseUrl: activeOllamaBaseUrl,
          modelName: activeOllamaModel,
          programmingLanguage: activeProgrammingLanguage
        });
      }

      console.log('Ollama AI Service initialized successfully');
      return ollamaService;
    } catch (error) {
      ollamaService = null;
      console.error('Failed to initialize Ollama AI Service:', error);
      return null;
    }
  }

  function initializeAiService() {
    if (activeAiProvider === 'ollama') {
      return initializeOllamaService(activeOllamaBaseUrl, activeOllamaModel, activeProgrammingLanguage);
    }
    if (activeAiProvider === 'grok') {
      return initializeGrokService(getActiveGrokApiKey(), activeGrokModel, activeProgrammingLanguage);
    }
    if (activeAiProvider === 'groq') {
      return initializeGroqService(getActiveGroqApiKey(), activeGroqModel, activeProgrammingLanguage);
    }
    if (activeAiProvider === 'bedrock') {
      return initializeBedrockService(
        getActiveBedrockApiKey(),
        activeBedrockModel,
        activeProgrammingLanguage,
        activeBedrockRegion
      );
    }
    return initializeGeminiService(getActiveApiKey(), activeGeminiModel, activeProgrammingLanguage);
  }

  function setActiveAiProvider(providerName) {
    activeAiProvider = resolveAiProvider(providerName);
    return activeAiProvider;
  }

  function getActiveAiProvider() {
    return activeAiProvider;
  }

  function setActiveOllamaBaseUrl(baseUrl) {
    activeOllamaBaseUrl = String(baseUrl || getDefaultOllamaBaseUrl())
      .trim()
      .replace(/\/+$/, '')
      .replace('://localhost', '://127.0.0.1');
    return activeOllamaBaseUrl;
  }

  function getActiveOllamaBaseUrl() {
    return activeOllamaBaseUrl;
  }

  function setActiveOllamaModel(modelName) {
    activeOllamaModel = String(modelName || getDefaultOllamaModel()).trim();
    return activeOllamaModel;
  }

  function getActiveOllamaModel() {
    return activeOllamaModel;
  }

  function getService() {
    if (activeAiProvider === 'ollama') {
      return ollamaService;
    }
    if (activeAiProvider === 'grok') {
      return grokService;
    }
    if (activeAiProvider === 'groq') {
      return groqService;
    }
    if (activeAiProvider === 'bedrock') {
      return bedrockService;
    }
    return geminiService;
  }

  function getActiveGeminiModel() {
    return activeGeminiModel;
  }

  function getActiveGrokModel() {
    return activeGrokModel;
  }

  function getActiveGroqModel() {
    return activeGroqModel;
  }

  function getActiveBedrockModel() {
    return activeBedrockModel;
  }

  function getActiveBedrockRegion() {
    return activeBedrockRegion;
  }

  function getActiveProgrammingLanguage() {
    return activeProgrammingLanguage;
  }

  function setActiveGeminiModel(modelName) {
    activeGeminiModel = resolveGeminiModel(modelName);
    return activeGeminiModel;
  }

  function setActiveGrokModel(modelName) {
    activeGrokModel = resolveGrokModel(modelName);
    return activeGrokModel;
  }

  function setActiveGroqModel(modelName) {
    activeGroqModel = resolveGroqModel(modelName);
    return activeGroqModel;
  }

  function setActiveBedrockModel(modelName) {
    activeBedrockModel = resolveBedrockModel(modelName);
    return activeBedrockModel;
  }

  function setActiveBedrockRegion(regionName) {
    activeBedrockRegion = resolveBedrockRegion(regionName);
    return activeBedrockRegion;
  }

  function setActiveProgrammingLanguage(language) {
    activeProgrammingLanguage = resolveProgrammingLanguage(language);
    return activeProgrammingLanguage;
  }

  function setActiveKeyIndexChangeHandler(handler) {
    activeKeyIndexChangeHandler = typeof handler === 'function' ? handler : null;
  }

  function setActiveGrokKeyIndexChangeHandler(handler) {
    activeGrokKeyIndexChangeHandler = typeof handler === 'function' ? handler : null;
  }

  function setActiveGroqKeyIndexChangeHandler(handler) {
    activeGroqKeyIndexChangeHandler = typeof handler === 'function' ? handler : null;
  }

  function setActiveBedrockKeyIndexChangeHandler(handler) {
    activeBedrockKeyIndexChangeHandler = typeof handler === 'function' ? handler : null;
  }

  return {
    initializeGeminiService,
    initializeGrokService,
    initializeGroqService,
    initializeBedrockService,
    initializeOllamaService,
    initializeAiService,
    setKeys,
    getApiKeys,
    hasApiKeys,
    getActiveApiKey,
    getActiveApiKeyIndex: () => activeApiKeyIndex,
    setGrokKeys,
    getGrokApiKeys,
    hasGrokApiKeys,
    getActiveGrokApiKey,
    getActiveGrokApiKeyIndex: () => activeGrokApiKeyIndex,
    setGroqKeys,
    getGroqApiKeys,
    hasGroqApiKeys,
    getActiveGroqApiKey,
    getActiveGroqApiKeyIndex: () => activeGroqApiKeyIndex,
    setBedrockKeys,
    getBedrockApiKeys,
    hasBedrockApiKeys,
    getActiveBedrockApiKey,
    getActiveBedrockApiKeyIndex: () => activeBedrockApiKeyIndex,
    isAiConfigured,
    getMissingApiKeyError,
    switchToNextKey,
    executeWithKeyFailover,
    isAllKeysUnavailableError,
    setActiveKeyIndexChangeHandler,
    setActiveGrokKeyIndexChangeHandler,
    setActiveGroqKeyIndexChangeHandler,
    setActiveBedrockKeyIndexChangeHandler,
    getService,
    getAiProviders,
    getDefaultAiProvider,
    getActiveAiProvider,
    setActiveAiProvider,
    getGeminiModels,
    getDefaultGeminiModel,
    getActiveGeminiModel,
    setActiveGeminiModel,
    getGrokModels,
    getDefaultGrokModel,
    getActiveGrokModel,
    setActiveGrokModel,
    getGroqModels,
    getDefaultGroqModel,
    getActiveGroqModel,
    setActiveGroqModel,
    getBedrockModels,
    getDefaultBedrockModel,
    getDefaultBedrockRegion,
    getActiveBedrockModel,
    setActiveBedrockModel,
    getActiveBedrockRegion,
    setActiveBedrockRegion,
    getDefaultOllamaBaseUrl,
    getDefaultOllamaModel,
    getActiveOllamaBaseUrl,
    setActiveOllamaBaseUrl,
    getActiveOllamaModel,
    setActiveOllamaModel,
    getProgrammingLanguages,
    getDefaultProgrammingLanguage,
    getActiveProgrammingLanguage,
    setActiveProgrammingLanguage
  };
}

module.exports = {
  GEMINI_ALL_KEYS_UNAVAILABLE_ERROR_CODE,
  createGeminiRuntime
};
