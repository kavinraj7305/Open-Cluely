function registerSettingsIpc({
  ipcMain,
  app,
  getAppEnvironment,
  setAppEnvironment,
  getAppState,
  setAppState,
  getAppStatePath,
  saveApplicationEnvironment,
  saveAppState,
  geminiRuntime,
  windowController,
  getAssemblyAiSpeechModel,
  setAssemblyAiSpeechModel,
  keyboardShortcuts,
  assemblyAiSpeechModels,
  defaultAssemblyAiSpeechModel
}) {
  ipcMain.handle('get-settings', () => {
    const appEnvironment = getAppEnvironment();
    const appState = getAppState();
    const geminiApiKey = typeof appState?.geminiApiKey === 'string' ? appState.geminiApiKey : '';
    const grokApiKey = typeof appState?.grokApiKey === 'string' ? appState.grokApiKey : '';
    const groqApiKey = typeof appState?.groqApiKey === 'string' ? appState.groqApiKey : '';
    const bedrockApiKey = typeof appState?.bedrockApiKey === 'string' ? appState.bedrockApiKey : '';
    const assemblyAiApiKey = typeof appState?.assemblyAiApiKey === 'string' ? appState.assemblyAiApiKey : '';

    return {
      aiProvider: geminiRuntime.getActiveAiProvider(),
      geminiApiKey,
      grokApiKey,
      groqApiKey,
      bedrockApiKey,
      assemblyAiApiKey,
      hasGeminiApiKeys: geminiApiKey.split(',').map((value) => value.trim()).filter(Boolean).length > 0,
      hasGrokApiKeys: grokApiKey.split(',').map((value) => value.trim()).filter(Boolean).length > 0,
      hasGroqApiKeys: groqApiKey.split(',').map((value) => value.trim()).filter(Boolean).length > 0,
      hasBedrockApiKeys: bedrockApiKey.split(',').map((value) => value.trim()).filter(Boolean).length > 0,
      hasAssemblyAiApiKey: assemblyAiApiKey.length > 0,
      geminiModel: geminiRuntime.getActiveGeminiModel(),
      geminiModels: geminiRuntime.getGeminiModels(),
      defaultGeminiModel: geminiRuntime.getDefaultGeminiModel(),
      grokModel: geminiRuntime.getActiveGrokModel(),
      grokModels: geminiRuntime.getGrokModels(),
      defaultGrokModel: geminiRuntime.getDefaultGrokModel(),
      groqModel: geminiRuntime.getActiveGroqModel(),
      groqModels: geminiRuntime.getGroqModels(),
      defaultGroqModel: geminiRuntime.getDefaultGroqModel(),
      bedrockModel: geminiRuntime.getActiveBedrockModel(),
      bedrockModels: geminiRuntime.getBedrockModels(),
      defaultBedrockModel: geminiRuntime.getDefaultBedrockModel(),
      bedrockRegion: geminiRuntime.getActiveBedrockRegion(),
      defaultBedrockRegion: geminiRuntime.getDefaultBedrockRegion(),
      ollamaBaseUrl: geminiRuntime.getActiveOllamaBaseUrl(),
      ollamaModel: geminiRuntime.getActiveOllamaModel(),
      defaultOllamaBaseUrl: geminiRuntime.getDefaultOllamaBaseUrl(),
      defaultOllamaModel: geminiRuntime.getDefaultOllamaModel(),
      programmingLanguage: geminiRuntime.getActiveProgrammingLanguage(),
      programmingLanguages: geminiRuntime.getProgrammingLanguages(),
      defaultProgrammingLanguage: geminiRuntime.getDefaultProgrammingLanguage(),
      assemblyAiSpeechModels,
      defaultAssemblyAiSpeechModel,
      assemblyAiSpeechModel: getAssemblyAiSpeechModel(),
      keyboardShortcuts,
      hideFromScreenCapture: appEnvironment.hideFromScreenCapture,
      startHidden: appEnvironment.startHidden,
      windowOpacityLevel: windowController.getWindowOpacityLevel(),
      themePreference: appState?.themePreference === 'dark' || appState?.themePreference === 'light'
        ? appState.themePreference
        : null
    };
  });

  ipcMain.handle('set-theme-preference', (_event, payload = {}) => {
    try {
      const requestedTheme = typeof payload === 'string'
        ? payload
        : payload?.theme;
      const normalizedTheme = String(requestedTheme || '').trim().toLowerCase();
      const themePreference = normalizedTheme === 'dark' ? 'dark' : 'light';

      const updatedAppState = saveAppState(app, { themePreference });
      setAppState(updatedAppState);

      return { success: true, themePreference };
    } catch (error) {
      console.error('Error saving theme preference:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('save-settings', async (_event, settings = {}) => {
    console.log('IPC: save-settings called');

    try {
      const appEnvironment = getAppEnvironment();
      const nextAiProvider = geminiRuntime.setActiveAiProvider(settings.aiProvider);
      const nextGeminiApiKey = String(settings.geminiApiKey || '').trim();
      const nextGrokApiKey = String(settings.grokApiKey || '').trim();
      const nextGroqApiKey = String(settings.groqApiKey || '').trim();
      const nextBedrockApiKey = String(settings.bedrockApiKey || '').trim();
      const nextAssemblyAiApiKey = String(settings.assemblyAiApiKey || '').trim();
      const nextGeminiModel = geminiRuntime.setActiveGeminiModel(settings.geminiModel);
      const nextGrokModel = geminiRuntime.setActiveGrokModel(settings.grokModel);
      const nextGroqModel = geminiRuntime.setActiveGroqModel(settings.groqModel);
      const nextBedrockModel = geminiRuntime.setActiveBedrockModel(settings.bedrockModel);
      const nextBedrockRegion = geminiRuntime.setActiveBedrockRegion(settings.bedrockRegion);
      const nextOllamaBaseUrl = geminiRuntime.setActiveOllamaBaseUrl(settings.ollamaBaseUrl);
      const nextOllamaModel = geminiRuntime.setActiveOllamaModel(settings.ollamaModel);
      const nextAssemblyModel = setAssemblyAiSpeechModel(settings.assemblyAiSpeechModel);
      const nextProgrammingLanguage = geminiRuntime.setActiveProgrammingLanguage(settings.programmingLanguage);
      const nextWindowOpacityLevel = windowController.setWindowOpacityLevel(settings.windowOpacityLevel);

      const updatedEnvironment = saveApplicationEnvironment(app, {
        hideFromScreenCapture: appEnvironment.hideFromScreenCapture,
        startHidden: appEnvironment.startHidden,
        maxScreenshots: appEnvironment.maxScreenshots,
        screenshotDelay: appEnvironment.screenshotDelay,
        nodeEnv: appEnvironment.nodeEnv,
        nodeOptions: appEnvironment.nodeOptions
      });

      const keyState = geminiRuntime.setKeys(nextGeminiApiKey, 0);
      const grokKeyState = geminiRuntime.setGrokKeys(nextGrokApiKey, 0);
      const groqKeyState = geminiRuntime.setGroqKeys(nextGroqApiKey, 0);
      const bedrockKeyState = geminiRuntime.setBedrockKeys(nextBedrockApiKey, 0);
      const updatedAppState = saveAppState(app, {
        aiProvider: nextAiProvider,
        geminiApiKey: nextGeminiApiKey,
        grokApiKey: nextGrokApiKey,
        groqApiKey: nextGroqApiKey,
        bedrockApiKey: nextBedrockApiKey,
        assemblyAiApiKey: nextAssemblyAiApiKey,
        geminiApiKeyIndex: keyState.activeApiKeyIndex,
        grokApiKeyIndex: grokKeyState.activeGrokApiKeyIndex,
        groqApiKeyIndex: groqKeyState.activeGroqApiKeyIndex,
        bedrockApiKeyIndex: bedrockKeyState.activeBedrockApiKeyIndex,
        geminiModel: nextGeminiModel,
        grokModel: nextGrokModel,
        groqModel: nextGroqModel,
        bedrockModel: nextBedrockModel,
        bedrockRegion: nextBedrockRegion,
        ollamaBaseUrl: nextOllamaBaseUrl,
        ollamaModel: nextOllamaModel,
        assemblyAiSpeechModel: nextAssemblyModel,
        programmingLanguage: nextProgrammingLanguage,
        windowOpacityLevel: nextWindowOpacityLevel
      });

      setAppEnvironment(updatedEnvironment);
      setAppState(updatedAppState);

      console.log('Saved app state to:', getAppStatePath(app));
      console.log('Settings saved to:', updatedEnvironment.envPath);
      console.log('Applied AI provider:', nextAiProvider);
      console.log('Applied programming language:', nextProgrammingLanguage);
      console.log(`Applied window opacity level: ${nextWindowOpacityLevel}/10`);

      if (nextAiProvider === 'ollama') {
        console.log(`Applied Ollama model: ${nextOllamaModel} at ${nextOllamaBaseUrl}`);
        geminiRuntime.initializeOllamaService(
          nextOllamaBaseUrl,
          nextOllamaModel,
          nextProgrammingLanguage
        );
      } else if (nextAiProvider === 'grok') {
        console.log(`Applied Grok API key index: ${grokKeyState.activeGrokApiKeyIndex + 1}/${grokKeyState.grokApiKeys.length}`);
        geminiRuntime.initializeGrokService(
          grokKeyState.activeGrokApiKey,
          nextGrokModel,
          nextProgrammingLanguage
        );
      } else if (nextAiProvider === 'groq') {
        console.log(`Applied Groq API key index: ${groqKeyState.activeGroqApiKeyIndex + 1}/${groqKeyState.groqApiKeys.length}`);
        geminiRuntime.initializeGroqService(
          groqKeyState.activeGroqApiKey,
          nextGroqModel,
          nextProgrammingLanguage
        );
      } else if (nextAiProvider === 'bedrock') {
        console.log(`Applied Bedrock API key index: ${bedrockKeyState.activeBedrockApiKeyIndex + 1}/${bedrockKeyState.bedrockApiKeys.length}`);
        geminiRuntime.initializeBedrockService(
          bedrockKeyState.activeBedrockApiKey,
          nextBedrockModel,
          nextProgrammingLanguage,
          nextBedrockRegion
        );
      } else {
        console.log(`Applied Gemini API key index: ${keyState.activeApiKeyIndex + 1}/${keyState.geminiApiKeys.length}`);
        geminiRuntime.initializeGeminiService(
          keyState.activeApiKey,
          nextGeminiModel,
          nextProgrammingLanguage
        );
      }

      return { success: true };
    } catch (error) {
      console.error('Error saving settings:', error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = {
  registerSettingsIpc
};
