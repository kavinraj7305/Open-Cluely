const {
  app,
  dialog,
  desktopCapturer,
  globalShortcut,
  ipcMain,
  screen
} = require('electron');
const WebSocket = require('ws');

const {
  loadApplicationEnvironment,
  normalizeGeminiApiKeys,
  saveApplicationEnvironment
} = require('../bootstrap/environment');
const {
  getAssemblyAiSpeechModels,
  getDefaultAssemblyAiSpeechModel,
  getKeyboardShortcuts,
  resolveAssemblyAiSpeechModel,
  inferAiProviderFromKeys
} = require('../config');
const {
  getAppStatePath,
  loadAppState,
  saveAppState
} = require('../services/state/app-state');
const { createAssistantWindow } = require('../windows/assistant/window');
const { createSafeSender } = require('./shared/safe-send');
const { createGeminiRuntime } = require('./features/assistant/gemini-runtime');
const { createScreenshotManager } = require('./features/assistant/screenshot-manager');
const { registerAssistantIpc } = require('./features/assistant/ipc');
const { createAssemblyAiService } = require('../services/assembly-ai/service');
const { registerAssemblyAiIpc } = require('../services/assembly-ai/ipc');
const { registerSettingsIpc } = require('./features/settings/ipc');
const { createWindowController } = require('./features/window/window-controller');
const { DEFAULT_WINDOW_OPACITY_LEVEL } = require('./features/window/window-constants');
const { logStartupConfiguration } = require('./startup-logging');
const { createMobileServer } = require('./features/mobile-server/server');

function resolveStartupOptions(argv = process.argv) {
  const normalizedArgs = Array.isArray(argv)
    ? argv.map((value) => String(value || '').trim().toLowerCase())
    : [];

  const hasFlag = (flag) => normalizedArgs.includes(flag);

  return {
    startHidden: hasFlag('--start-hidden') || hasFlag('--background')
  };
}

async function startApplication() {
  let appEnvironment = null;
  let appState = null;
  let isShuttingDown = false;
  const startupOptions = resolveStartupOptions();

  const geminiRuntime = createGeminiRuntime();

  const assemblyAiSpeechModels = getAssemblyAiSpeechModels();
  const defaultAssemblyAiSpeechModel = getDefaultAssemblyAiSpeechModel();
  const keyboardShortcuts = getKeyboardShortcuts();
  let activeAssemblyAiSpeechModel = defaultAssemblyAiSpeechModel;

  let screenshotManager = null;
  let windowController = null;

  const baseSendToRenderer = createSafeSender(() => {
    if (!windowController) {
      return null;
    }

    return windowController.getMainWindow();
  });

  // Mobile server reports its own status (listening, URLs, client count) to
  // the desktop renderer via the un-augmented sender — we don't want it
  // bouncing back to mobile clients.
  const mobileServer = createMobileServer({
    getGeminiRuntime:    () => geminiRuntime,
    getScreenshotManager: () => screenshotManager,
    notifyDesktop:        baseSendToRenderer
  });

  // Augmented sender: events flow to both the Electron renderer and all
  // connected mobile WebSocket clients simultaneously.
  const sendToRenderer = (channel, data) => {
    baseSendToRenderer(channel, data);
    mobileServer.broadcast(channel, data);
  };

  const assemblyAiService = createAssemblyAiService({
    WebSocket,
    desktopCapturer,
    getAssemblyApiKey: () => appState?.assemblyAiApiKey || '',
    getSpeechModel: () => activeAssemblyAiSpeechModel,
    getGeminiService: () => geminiRuntime.getService(),
    sendToRenderer
  });

  windowController = createWindowController({
    app,
    screen,
    globalShortcut,
    createAssistantWindow,
    getAppEnvironment: () => appEnvironment,
    emitSttDebug: assemblyAiService.emitSttDebug,
    sendToRenderer,
    onTakeStealthScreenshot: async () => {
      if (screenshotManager) {
        await screenshotManager.takeStealthScreenshot();
      }
    },
    onQuitApplication: () => {
      quitApplication();
    }
  });

  screenshotManager = createScreenshotManager({
    app,
    getMainWindow: () => windowController.getMainWindow(),
    getAppEnvironment: () => appEnvironment,
    sendToRenderer
  });

  function loadPersistedAppState() {
    appState = loadAppState(app);

    const keyState = geminiRuntime.setKeys(
      normalizeGeminiApiKeys(appState?.geminiApiKey),
      appState.geminiApiKeyIndex
    );
    const grokKeyState = geminiRuntime.setGrokKeys(
      normalizeGeminiApiKeys(appState?.grokApiKey),
      appState.grokApiKeyIndex
    );
    const groqKeyState = geminiRuntime.setGroqKeys(
      normalizeGeminiApiKeys(appState?.groqApiKey),
      appState.groqApiKeyIndex
    );
    const bedrockKeyState = geminiRuntime.setBedrockKeys(
      normalizeGeminiApiKeys(appState?.bedrockApiKey),
      appState.bedrockApiKeyIndex
    );
    const inferredAiProvider = inferAiProviderFromKeys({
      aiProvider: appState.aiProvider,
      bedrockApiKey: appState.bedrockApiKey,
      groqApiKey: appState.groqApiKey,
      grokApiKey: appState.grokApiKey,
      geminiApiKey: appState.geminiApiKey
    });
    const activeAiProvider = geminiRuntime.setActiveAiProvider(inferredAiProvider);
    const activeGeminiModel = geminiRuntime.setActiveGeminiModel(appState.geminiModel);
    const activeGrokModel = geminiRuntime.setActiveGrokModel(appState.grokModel);
    const activeGroqModel = geminiRuntime.setActiveGroqModel(appState.groqModel);
    const activeBedrockModel = geminiRuntime.setActiveBedrockModel(appState.bedrockModel);
    const activeBedrockRegion = geminiRuntime.setActiveBedrockRegion(appState.bedrockRegion);
    const activeOllamaBaseUrl = geminiRuntime.setActiveOllamaBaseUrl(appState.ollamaBaseUrl);
    const activeOllamaModel = geminiRuntime.setActiveOllamaModel(appState.ollamaModel);
    activeAssemblyAiSpeechModel = resolveAssemblyAiSpeechModel(appState.assemblyAiSpeechModel);
    const activeProgrammingLanguage = geminiRuntime.setActiveProgrammingLanguage(appState.programmingLanguage);
    const activeWindowOpacityLevel = windowController.setWindowOpacityLevel(appState.windowOpacityLevel);

    if (
      appState.aiProvider !== activeAiProvider ||
      appState.geminiApiKeyIndex !== keyState.activeApiKeyIndex ||
      appState.grokApiKeyIndex !== grokKeyState.activeGrokApiKeyIndex ||
      appState.groqApiKeyIndex !== groqKeyState.activeGroqApiKeyIndex ||
      appState.bedrockApiKeyIndex !== bedrockKeyState.activeBedrockApiKeyIndex ||
      appState.geminiModel !== activeGeminiModel ||
      appState.grokModel !== activeGrokModel ||
      appState.groqModel !== activeGroqModel ||
      appState.bedrockModel !== activeBedrockModel ||
      appState.bedrockRegion !== activeBedrockRegion ||
      appState.ollamaBaseUrl !== activeOllamaBaseUrl ||
      appState.ollamaModel !== activeOllamaModel ||
      appState.assemblyAiSpeechModel !== activeAssemblyAiSpeechModel ||
      appState.programmingLanguage !== activeProgrammingLanguage ||
      appState.windowOpacityLevel !== activeWindowOpacityLevel
    ) {
      appState = saveAppState(app, {
        aiProvider: activeAiProvider,
        geminiApiKeyIndex: keyState.activeApiKeyIndex,
        grokApiKeyIndex: grokKeyState.activeGrokApiKeyIndex,
        groqApiKeyIndex: groqKeyState.activeGroqApiKeyIndex,
        bedrockApiKeyIndex: bedrockKeyState.activeBedrockApiKeyIndex,
        geminiModel: activeGeminiModel,
        grokModel: activeGrokModel,
        groqModel: activeGroqModel,
        bedrockModel: activeBedrockModel,
        bedrockRegion: activeBedrockRegion,
        ollamaBaseUrl: activeOllamaBaseUrl,
        ollamaModel: activeOllamaModel,
        assemblyAiSpeechModel: activeAssemblyAiSpeechModel,
        programmingLanguage: activeProgrammingLanguage,
        windowOpacityLevel: activeWindowOpacityLevel
      });
    }

    console.log('Loaded app state from:', getAppStatePath(app));
    console.log('Restored AI provider from app state:', activeAiProvider);
    console.log(`Restored Gemini API key index from app state: ${keyState.activeApiKeyIndex + 1}/${keyState.geminiApiKeys.length}`);
    console.log(`Restored Grok API key index from app state: ${grokKeyState.activeGrokApiKeyIndex + 1}/${grokKeyState.grokApiKeys.length}`);
    console.log(`Restored Groq API key index from app state: ${groqKeyState.activeGroqApiKeyIndex + 1}/${groqKeyState.groqApiKeys.length}`);
    console.log(`Restored Bedrock API key index from app state: ${bedrockKeyState.activeBedrockApiKeyIndex + 1}/${bedrockKeyState.bedrockApiKeys.length}`);
    console.log('Restored Gemini model from app state:', activeGeminiModel);
    console.log('Restored Grok model from app state:', activeGrokModel);
    console.log('Restored Groq model from app state:', activeGroqModel);
    console.log('Restored Bedrock model from app state:', activeBedrockModel, 'in', activeBedrockRegion);
    console.log('Restored Ollama config from app state:', activeOllamaModel, 'at', activeOllamaBaseUrl);
    console.log('Restored AssemblyAI speech model from app state:', activeAssemblyAiSpeechModel);
    console.log('Restored programming language from app state:', activeProgrammingLanguage);
    console.log(`Restored window opacity level from app state: ${activeWindowOpacityLevel}/10`);
  }

  function cleanupTransientResources() {
    assemblyAiService.dispose();
    screenshotManager.cleanupTransientResources();
    windowController.unregisterShortcuts();
    mobileServer.close();
  }

  function quitApplication() {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;

    cleanupTransientResources();
    windowController.destroyWindow();

    setTimeout(() => {
      app.exit(0);
    }, 50);
  }

  ipcMain.handle('mobile-server-get-status', () => mobileServer.getStatus());

  registerAssistantIpc({
    ipcMain,
    screenshotManager,
    windowController,
    geminiRuntime,
    assemblyAiService,
    sendToRenderer,
    quitApplication
  });

  registerAssemblyAiIpc({
    ipcMain,
    assemblyAiService
  });

  registerSettingsIpc({
    ipcMain,
    app,
    getAppEnvironment: () => appEnvironment,
    setAppEnvironment: (nextEnvironment) => {
      appEnvironment = nextEnvironment;
    },
    getAppState: () => appState,
    setAppState: (nextAppState) => {
      appState = nextAppState;
    },
    getAppStatePath,
    saveApplicationEnvironment,
    saveAppState,
    geminiRuntime,
    windowController,
    getAssemblyAiSpeechModel: () => activeAssemblyAiSpeechModel,
    setAssemblyAiSpeechModel: (nextModel) => {
      activeAssemblyAiSpeechModel = resolveAssemblyAiSpeechModel(nextModel, activeAssemblyAiSpeechModel);
      return activeAssemblyAiSpeechModel;
    },
    keyboardShortcuts,
    assemblyAiSpeechModels,
    defaultAssemblyAiSpeechModel
  });

  app.whenReady().then(() => {
    try {
      appEnvironment = loadApplicationEnvironment(app);
    } catch (error) {
      console.error('Failed to load application environment:', error);
      dialog.showErrorBox('Open-Cluely Configuration Error', error.message);
      app.exit(1);
      return;
    }

    loadPersistedAppState();

    logStartupConfiguration({
      appEnvironment,
      appState,
      geminiModels: geminiRuntime.getGeminiModels(),
      defaultGeminiModel: geminiRuntime.getDefaultGeminiModel(),
      assemblyAiSpeechModels,
      defaultAssemblyAiSpeechModel,
      programmingLanguages: geminiRuntime.getProgrammingLanguages(),
      defaultProgrammingLanguage: geminiRuntime.getDefaultProgrammingLanguage()
    });

    geminiRuntime.setActiveKeyIndexChangeHandler((nextIndex) => {
      if (!appState || appState.geminiApiKeyIndex === nextIndex) {
        return;
      }

      appState = saveAppState(app, { geminiApiKeyIndex: nextIndex });
      console.log(`Persisted Gemini API key index: ${nextIndex + 1}/${geminiRuntime.getApiKeys().length}`);
    });

    geminiRuntime.setActiveGrokKeyIndexChangeHandler((nextIndex) => {
      if (!appState || appState.grokApiKeyIndex === nextIndex) {
        return;
      }

      appState = saveAppState(app, { grokApiKeyIndex: nextIndex });
      console.log(`Persisted Grok API key index: ${nextIndex + 1}/${geminiRuntime.getGrokApiKeys().length}`);
    });

    geminiRuntime.setActiveGroqKeyIndexChangeHandler((nextIndex) => {
      if (!appState || appState.groqApiKeyIndex === nextIndex) {
        return;
      }

      appState = saveAppState(app, { groqApiKeyIndex: nextIndex });
      console.log(`Persisted Groq API key index: ${nextIndex + 1}/${geminiRuntime.getGroqApiKeys().length}`);
    });

    geminiRuntime.setActiveBedrockKeyIndexChangeHandler((nextIndex) => {
      if (!appState || appState.bedrockApiKeyIndex === nextIndex) {
        return;
      }

      appState = saveAppState(app, { bedrockApiKeyIndex: nextIndex });
      console.log(`Persisted Bedrock API key index: ${nextIndex + 1}/${geminiRuntime.getBedrockApiKeys().length}`);
    });

    geminiRuntime.initializeAiService();

    app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder');
    app.commandLine.appendSwitch('ignore-certificate-errors');
    app.commandLine.appendSwitch('allow-running-insecure-content');
    app.commandLine.appendSwitch('disable-web-security');
    app.commandLine.appendSwitch('enable-media-stream');

    const launchHidden = startupOptions.startHidden || appEnvironment.startHidden;
    console.log('App is ready, creating window...');
    console.log(`Startup mode: ${launchHidden ? 'hidden' : 'visible'}`);
    windowController.createWindow({ launchHidden });
    windowController.registerShortcuts();

    if (!launchHidden) {
      windowController.markVisible();
    }

    if (appState?.windowOpacityLevel == null) {
      windowController.setWindowOpacityLevel(DEFAULT_WINDOW_OPACITY_LEVEL);
    }

    console.log(`Window setup complete (${launchHidden ? 'hidden launch' : 'visible launch'})`);
  });

  app.on('window-all-closed', () => {
    // Keep running in background for stealth operation
  });

  app.on('activate', () => {
    if (!windowController.hasWindow()) {
      windowController.createWindow();
      windowController.markVisible();
    }
  });

  app.on('will-quit', () => {
    cleanupTransientResources();
  });

  app.on('web-contents-created', (_event, contents) => {
    contents.on('new-window', (event) => {
      event.preventDefault();
    });

    contents.on('will-navigate', (event, navigationUrl) => {
      const mainWindow = windowController.getMainWindow();
      if (!mainWindow || mainWindow.isDestroyed()) {
        return;
      }

      if (navigationUrl !== mainWindow.webContents.getURL()) {
        event.preventDefault();
      }
    });
  });

  process.title = 'SystemIdleProcess';
}

module.exports = {
  startApplication
};
