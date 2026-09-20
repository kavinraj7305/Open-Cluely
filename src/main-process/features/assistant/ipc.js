const path = require('path');
const { extractCodingOnlyFromResponse } = require('../../../services/ai/prompts');

function registerAssistantIpc({
  ipcMain,
  screenshotManager,
  windowController,
  geminiRuntime,
  assemblyAiService,
  sendToRenderer,
  quitApplication
}) {
  let chatContext = [];
  const {
    createRequestId,
    clip,
    preview,
    appendAiRequestLog,
    logAiEvent,
    getLogFilePath
  } = require('../../../services/debug/ai-request-log');

  function getActiveServiceSnapshot() {
    const service = geminiRuntime.getService();
    return {
      provider: geminiRuntime.getActiveAiProvider(),
      model: service?.modelName || service?.model || null,
      region: service?.region || null,
      programmingLanguage: geminiRuntime.getActiveProgrammingLanguage(),
      historyLength: Array.isArray(service?.conversationHistory)
        ? service.conversationHistory.length
        : 0,
      supportsImages: service?.modelSupportsImages?.() === true
    };
  }

  function logAiRequest(entry) {
    const record = appendAiRequestLog(entry);
    const requestId = entry.requestId || 'unknown';
    logAiEvent(requestId, `${entry.action || entry.event} ${entry.status || ''}`.trim());
    if (entry.ocrText) {
      logAiEvent(requestId, `OCR ${String(entry.ocrText).length} chars: ${preview(entry.ocrText)}`);
    } else if (entry.needsOcr) {
      logAiEvent(requestId, 'OCR empty — model cannot see the screenshot');
    }
    if (entry.contextString) {
      logAiEvent(requestId, `Chat context ${String(entry.contextString).length} chars: ${preview(entry.contextString)}`);
    }
    if (entry.responseText) {
      logAiEvent(requestId, `Answer ${String(entry.responseText).length} chars: ${preview(entry.responseText)}`);
    }
    if (entry.error) {
      logAiEvent(requestId, `Error: ${entry.error}`);
    }
    logAiEvent(requestId, `Saved ${getLogFilePath()}`);
    return record;
  }

  function getAllKeysUnavailableMessage() {
    const provider = geminiRuntime.getActiveAiProvider();
    if (provider === 'grok') {
      return 'All configured Grok API keys are currently unavailable (quota exhausted or invalid). Please wait and try again later.';
    }
    if (provider === 'groq') {
      return 'All configured Groq API keys are currently unavailable (quota exhausted or invalid). Please wait and try again later.';
    }
    if (provider === 'bedrock') {
      return 'All configured Bedrock API keys are currently unavailable (quota exhausted or invalid). Please wait and try again later.';
    }
    return 'All configured Gemini API keys are currently unavailable (quota exhausted or invalid). Please wait and try again later.';
  }

  function mapGeminiErrorMessage(error, fallbackPrefix = 'Request failed') {
    const message = String(error?.message || '');
    const normalizedMessage = message.toLowerCase();
    const provider = geminiRuntime.getActiveAiProvider();
    const providerLabel = provider === 'grok'
      ? 'Grok'
      : provider === 'groq'
        ? 'Groq'
        : provider === 'bedrock'
          ? 'Bedrock'
          : 'Gemini';

    if (geminiRuntime.isAllKeysUnavailableError?.(error)) {
      return getAllKeysUnavailableMessage();
    }

    if (normalizedMessage.includes('ollama service not available') || normalizedMessage.includes('econnrefused')) {
      return 'Cannot connect to Ollama. Make sure Ollama is running locally.';
    }

    if (normalizedMessage.includes('no api key configured') || normalizedMessage.includes('no gemini api key') || normalizedMessage.includes('no grok api key') || normalizedMessage.includes('no groq api key') || normalizedMessage.includes('no bedrock api key')) {
      if (provider === 'grok') {
        return 'No Grok API key configured. Add it in Settings.';
      }
      if (provider === 'groq') {
        return 'No Groq API key configured. Add it in Settings.';
      }
      if (provider === 'bedrock') {
        return 'No Bedrock API key configured. Add it in Settings.';
      }
      if (provider === 'ollama') {
        return 'Cannot connect to Ollama. Make sure Ollama is running locally.';
      }
      return 'No Gemini API key configured. Add it in Settings.';
    }

    if (
      normalizedMessage.includes('api key not valid') ||
      normalizedMessage.includes('invalid api key') ||
      normalizedMessage.includes('incorrect api key') ||
      normalizedMessage.includes('api_key_invalid') ||
      normalizedMessage.includes('permission denied') ||
      normalizedMessage.includes('permission_denied') ||
      normalizedMessage.includes('unauthorized') ||
      normalizedMessage.includes('forbidden') ||
      normalizedMessage.includes('401') ||
      normalizedMessage.includes('403')
    ) {
      return `Invalid ${providerLabel} API key. Please check the key values in Settings.`;
    }

    if (
      normalizedMessage.includes('quota') ||
      normalizedMessage.includes('daily request limit') ||
      normalizedMessage.includes('exceeded your current quota') ||
      normalizedMessage.includes('rate_limit') ||
      normalizedMessage.includes('request too large') ||
      normalizedMessage.includes('413') ||
      normalizedMessage.includes('itpm')
    ) {
      if (provider === 'groq') {
        return 'Groq free-tier limit hit. Wait about a minute, then try again with one screenshot. Answers are capped to fit Groq’s 1000 output tokens/min.';
      }
      return 'API quota exceeded. Please try again later.';
    }

    if (normalizedMessage.includes('network') || normalizedMessage.includes('fetch')) {
      return 'Network error. Please check your internet connection.';
    }

    if (normalizedMessage.includes('isn\'t supported') || normalizedMessage.includes('is not supported') || normalizedMessage.includes('validationexception')) {
      return 'Bedrock model or region error. Check the model ID and region in Settings (SkillForge uses ap-south-1).';
    }

    if (normalizedMessage.includes('model')) {
      return 'AI model error. Please try a different model.';
    }

    return message ? `${fallbackPrefix}: ${message}` : fallbackPrefix;
  }

  async function readLatestScreenshotOcr(enabledScreenshotIds, { strict = false } = {}) {
    const ocrResult = await screenshotManager.extractOcrTextFromScreenshots({
      strict,
      includeIds: enabledScreenshotIds,
      latestOnly: true
    });
    const entries = ocrResult.entries || [];
    const ocrText = String(ocrResult.ocrText || '').trim();

    return {
      entries,
      ocrText,
      files: ocrResult.files || [],
      screenshotFiles: entries.map((entry) => path.basename(entry.path || '')),
      screenshotIds: entries.map((entry) => entry.id)
    };
  }

  async function analyzeForMeetingWithContext(contextInput = '') {
    const payload = typeof contextInput === 'object' && contextInput !== null
      ? contextInput
      : { contextString: String(contextInput || '') };

    const contextString = '';
    const enabledScreenshotIds = Array.isArray(payload.enabledScreenshotIds) ? payload.enabledScreenshotIds : null;
    const requestId = createRequestId('screenAi');
    const startedAt = Date.now();
    const serviceSnapshot = getActiveServiceSnapshot();
    geminiRuntime.getService()?.clearHistory?.();

    console.log('Starting context-aware analysis...');
    console.log('Context length:', contextString.length);
    console.log('AI provider:', serviceSnapshot.provider);
    console.log('AI configured:', geminiRuntime.isAiConfigured());
    console.log('Model initialized:', !!(geminiRuntime.getService() && geminiRuntime.getService().model));
    console.log('Programming language preference:', serviceSnapshot.programmingLanguage);
    console.log('Screenshots count:', screenshotManager.getScreenshotsCount());
    logAiEvent(requestId, `Screen AI start provider=${serviceSnapshot.provider} model=${serviceSnapshot.model} latestScreenshotOcrOnly=true`);

    if (!geminiRuntime.isAiConfigured()) {
      sendToRenderer('analysis-result', {
        error: geminiRuntime.getMissingApiKeyError().message
      });
      return;
    }

    if (!screenshotManager.hasScreenshots()) {
      sendToRenderer('analysis-result', {
        error: 'No screenshots to analyze. Take a screenshot first.'
      });
      return;
    }

    try {
      sendToRenderer('analysis-start');

      const {
        entries,
        ocrText,
        files: ocrFiles,
        screenshotFiles,
        screenshotIds
      } = await readLatestScreenshotOcr(enabledScreenshotIds, { strict: true });

      if (!entries.length) {
        sendToRenderer('analysis-result', {
          error: 'No enabled screenshots selected for analysis.'
        });
        return;
      }

      if (!ocrText) {
        sendToRenderer('analysis-result', {
          error: 'Could not read text from the latest screenshot. Capture the question again.'
        });
        return;
      }

      const onChunk = ({ text, index }) => {
        sendToRenderer('ai-stream-chunk', { actionId: 'screenAi', text, index });
      };
      sendToRenderer('ai-stream-start', { actionId: 'screenAi' });

      const text = await geminiRuntime.executeWithKeyFailover((geminiService) => {
        if (!geminiService) {
          throw new Error('AI model not initialized. Please check your API key.');
        }

        return geminiService.analyzeScreenshots(
          [],
          '',
          { contextStringOverride: '', ocrText, onChunk, requestId }
        );
      });

      logAiRequest({
        requestId,
        action: 'screenAi',
        status: 'ok',
        ms: Date.now() - startedAt,
        ...serviceSnapshot,
        screenshotCount: 1,
        screenshotIds,
        screenshotFiles,
        needsOcr: true,
        ocrChars: ocrText.length,
        ocrFiles: (ocrFiles || []).map((file) => ({
          id: file.id,
          file: file.file,
          chars: file.chars,
          ms: file.ms,
          text: clip(file.text)
        })),
        ocrText: clip(ocrText),
        contextChars: 0,
        contextString: '',
        chatContextCount: 0,
        responseChars: String(text || '').length,
        responseText: clip(text)
      });

      sendToRenderer('ai-stream-end', { actionId: 'screenAi' });
      sendToRenderer('analysis-result', { text });
    } catch (error) {
      console.error('Analysis error details:', error);

      logAiRequest({
        requestId,
        action: 'screenAi',
        status: 'error',
        ms: Date.now() - startedAt,
        ...serviceSnapshot,
        needsOcr: true,
        contextString: clip(contextString),
        error: String(error?.message || error)
      });

      sendToRenderer('ai-stream-end', { actionId: 'screenAi' });
      sendToRenderer('analysis-result', {
        error: mapGeminiErrorMessage(error, 'Analysis failed')
      });
    }
  }

  async function analyzeForMeeting() {
    await analyzeForMeetingWithContext();
  }

  ipcMain.handle('get-screenshots-count', () => {
    return screenshotManager.getScreenshotsCount();
  });

  ipcMain.handle('get-window-bounds', () => {
    return windowController.getWindowBounds();
  });

  ipcMain.handle('set-window-bounds', (_event, nextBounds) => {
    return windowController.setWindowBounds(nextBounds);
  });

  ipcMain.handle('set-window-size-preset', (_event, payload = {}) => {
    const preset = typeof payload === 'number' ? payload : payload?.preset;
    return windowController.setWindowSizePreset(preset);
  });

  ipcMain.handle('toggle-stealth', () => {
    return windowController.toggleStealthMode();
  });

  ipcMain.handle('emergency-hide', (_event, payload = {}) => {
    const silent = payload?.silent === true;
    return windowController.emergencyHide({ silent });
  });

  ipcMain.handle('take-stealth-screenshot', async () => {
    return screenshotManager.takeStealthScreenshot();
  });

  ipcMain.handle('analyze-stealth', async () => {
    return analyzeForMeeting();
  });

  ipcMain.handle('analyze-stealth-with-context', async (_event, context) => {
    return analyzeForMeetingWithContext(context);
  });

  ipcMain.handle('ask-ai-with-session-context', async (_event, payload = {}) => {
    const requestId = createRequestId('askAi');
    const startedAt = Date.now();
    const serviceSnapshot = getActiveServiceSnapshot();
    const answerMode = payload?.answerMode === 'coding' ? 'coding' : 'aptitude';
    const streamActionId = answerMode === 'coding' ? 'codingAi' : 'askAi';
    logAiEvent(requestId, `Ask AI start provider=${serviceSnapshot.provider} model=${serviceSnapshot.model} answerMode=${answerMode} latestScreenshotOcrOnly=true`);
    geminiRuntime.getService()?.clearHistory?.();

    try {
      assemblyAiService.flushAllSttHistoryBuffers('pre-ask-ai');

      if (!geminiRuntime.isAiConfigured()) {
        throw geminiRuntime.getMissingApiKeyError();
      }

      const transcriptContext = '';
      const sessionSummary = '';
      const contextString = '';
      const enabledScreenshotIds = Array.isArray(payload?.enabledScreenshotIds)
        ? payload.enabledScreenshotIds.filter((id) => typeof id === 'string' && id.trim().length > 0)
        : null;

      if (!screenshotManager.hasScreenshots()) {
        return {
          success: false,
          error: 'No screenshot to answer. Capture the question first.',
          mode: answerMode,
          usedScreenshots: false
        };
      }

      const onChunk = ({ text, index }) => {
        sendToRenderer('ai-stream-chunk', { actionId: streamActionId, text, index });
      };
      sendToRenderer('ai-stream-start', { actionId: streamActionId });

      const {
        entries,
        ocrText,
        files: ocrFiles,
        screenshotFiles,
        screenshotIds
      } = await readLatestScreenshotOcr(enabledScreenshotIds, { strict: false });

      if (!entries.length) {
        throw new Error('Could not read the latest screenshot. Capture the question again.');
      }

      const usedScreenshots = true;
      const usedScreenshotCount = 1;
      const text = await geminiRuntime.executeWithKeyFailover(async (geminiService) => {
        if (!geminiService) {
          throw new Error('AI model not initialized. Please check your API key.');
        }

        if (ocrText) {
          return geminiService.askAiWithSessionContext({
            contextString: '',
            transcriptContext: '',
            sessionSummary: '',
            screenshotCount: 1,
            ocrText,
            mode: answerMode,
            answerMode,
            onChunk,
            requestId
          });
        }

        const { imageParts } = await screenshotManager.buildImagePartsFromScreenshots({
          strict: false,
          includeIds: enabledScreenshotIds,
          latestOnly: true
        });

        if (!imageParts.length) {
          throw new Error('Could not read text from the latest screenshot. Capture the question again.');
        }

        return geminiService.askAiWithSessionContextAndScreenshots(imageParts, {
          contextString: '',
          transcriptContext: '',
          sessionSummary: '',
          screenshotCount: 1,
          ocrText: '',
          mode: answerMode,
          answerMode,
          onChunk,
          requestId
        });
      });

      if (!text) {
        throw new Error('Could not read the latest screenshot. Capture the question again.');
      }

      const responseText = answerMode === 'coding'
        ? extractCodingOnlyFromResponse(text)
        : text;

      logAiRequest({
        requestId,
        action: streamActionId,
        status: 'ok',
        ms: Date.now() - startedAt,
        ...serviceSnapshot,
        screenshotCount: usedScreenshotCount,
        screenshotIds,
        screenshotFiles,
        needsOcr: Boolean(ocrText),
        ocrChars: ocrText.length,
        ocrFiles: ocrFiles.map((file) => ({
          id: file.id,
          file: file.file,
          chars: file.chars,
          ms: file.ms,
          text: clip(file.text)
        })),
        ocrText: clip(ocrText),
        contextChars: 0,
        contextString: '',
        transcriptChars: 0,
        transcriptContext: '',
        sessionSummary: '',
        chatContextCount: 0,
        responseChars: String(responseText || '').length,
        responseText: clip(responseText)
      });

      sendToRenderer('ai-stream-end', { actionId: streamActionId });
      return { success: true, text: responseText, mode: answerMode, usedScreenshots };
    } catch (error) {
      console.error('Error in ask-ai-with-session-context:', error);
      logAiRequest({
        requestId,
        action: streamActionId,
        status: 'error',
        ms: Date.now() - startedAt,
        ...serviceSnapshot,
        error: String(error?.message || error)
      });
      sendToRenderer('ai-stream-end', { actionId: streamActionId });
      return {
        success: false,
        error: mapGeminiErrorMessage(error, 'Ask AI failed'),
        mode: answerMode,
        usedScreenshots: false
      };
    }
  });

  ipcMain.handle('clear-stealth', () => {
    chatContext = [];
    return screenshotManager.clearStealth();
  });

  ipcMain.handle('close-app', () => {
    setTimeout(() => {
      quitApplication();
    }, 0);

    return { success: true };
  });

  ipcMain.handle('add-voice-transcript', async (_event, transcript) => {
    const geminiService = geminiRuntime.getService();
    if (geminiService) {
      geminiService.addToHistory('user', transcript);
    }

    return { success: true };
  });

  ipcMain.handle('suggest-response', async (_event, context) => {
    try {
      assemblyAiService.flushAllSttHistoryBuffers('pre-suggest');
      if (!geminiRuntime.isAiConfigured()) {
        throw geminiRuntime.getMissingApiKeyError();
      }

      const payload = typeof context === 'object' && context !== null
        ? context
        : { context };
      const contextPrompt = typeof payload.context === 'string'
        ? payload.context
        : 'Current meeting conversation';
      const contextStringOverride = typeof payload.contextString === 'string'
        ? payload.contextString
        : '';

      const onChunk = ({ text, index }) => {
        sendToRenderer('ai-stream-chunk', { actionId: 'suggest', text, index });
      };
      sendToRenderer('ai-stream-start', { actionId: 'suggest' });

      const suggestions = await geminiRuntime.executeWithKeyFailover((geminiService) => {
        if (!geminiService) {
          throw new Error('Gemini service not initialized');
        }

        return geminiService.suggestResponse(contextPrompt, {
          contextString: contextStringOverride,
          onChunk
        });
      });

      sendToRenderer('ai-stream-end', { actionId: 'suggest' });
      return { success: true, suggestions };
    } catch (error) {
      console.error('Error generating suggestions:', error);
      sendToRenderer('ai-stream-end', { actionId: 'suggest' });
      return { success: false, error: mapGeminiErrorMessage(error, 'Failed to generate suggestions') };
    }
  });

  ipcMain.handle('generate-meeting-notes', async (_event, payload = {}) => {
    try {
      assemblyAiService.flushAllSttHistoryBuffers('pre-notes');
      if (!geminiRuntime.isAiConfigured()) {
        throw geminiRuntime.getMissingApiKeyError();
      }

      const contextStringOverride = typeof payload?.contextString === 'string'
        ? payload.contextString
        : '';

      const onChunk = ({ text, index }) => {
        sendToRenderer('ai-stream-chunk', { actionId: 'notes', text, index });
      };
      sendToRenderer('ai-stream-start', { actionId: 'notes' });

      const notes = await geminiRuntime.executeWithKeyFailover((geminiService) => {
        if (!geminiService) {
          throw new Error('Gemini service not initialized');
        }

        return geminiService.generateMeetingNotes({
          contextString: contextStringOverride,
          onChunk
        });
      });

      sendToRenderer('ai-stream-end', { actionId: 'notes' });
      return { success: true, notes };
    } catch (error) {
      console.error('Error generating meeting notes:', error);
      sendToRenderer('ai-stream-end', { actionId: 'notes' });
      return { success: false, error: mapGeminiErrorMessage(error, 'Failed to generate meeting notes') };
    }
  });

  ipcMain.handle('generate-follow-up-email', async () => {
    try {
      assemblyAiService.flushAllSttHistoryBuffers('pre-followup');
      if (!geminiRuntime.isAiConfigured()) {
        throw geminiRuntime.getMissingApiKeyError();
      }

      const email = await geminiRuntime.executeWithKeyFailover((geminiService) => {
        if (!geminiService) {
          throw new Error('Gemini service not initialized');
        }

        return geminiService.generateFollowUpEmail();
      });

      return { success: true, email };
    } catch (error) {
      console.error('Error generating email:', error);
      return { success: false, error: mapGeminiErrorMessage(error, 'Failed to generate follow-up email') };
    }
  });

  ipcMain.handle('answer-question', async (_event, question) => {
    try {
      assemblyAiService.flushAllSttHistoryBuffers('pre-answer');
      if (!geminiRuntime.isAiConfigured()) {
        throw geminiRuntime.getMissingApiKeyError();
      }

      const answer = await geminiRuntime.executeWithKeyFailover((geminiService) => {
        if (!geminiService) {
          throw new Error('Gemini service not initialized');
        }

        return geminiService.answerQuestion(question);
      });

      return { success: true, answer };
    } catch (error) {
      console.error('Error answering question:', error);
      return { success: false, error: mapGeminiErrorMessage(error, 'Failed to answer question') };
    }
  });

  ipcMain.handle('get-conversation-insights', async (_event, payload = {}) => {
    try {
      assemblyAiService.flushAllSttHistoryBuffers('pre-insights');
      if (!geminiRuntime.isAiConfigured()) {
        throw geminiRuntime.getMissingApiKeyError();
      }

      const contextStringOverride = typeof payload?.contextString === 'string'
        ? payload.contextString
        : '';

      const onChunk = ({ text, index }) => {
        sendToRenderer('ai-stream-chunk', { actionId: 'insights', text, index });
      };
      sendToRenderer('ai-stream-start', { actionId: 'insights' });

      const insights = await geminiRuntime.executeWithKeyFailover((geminiService) => {
        if (!geminiService) {
          throw new Error('Gemini service not initialized');
        }

        return geminiService.getConversationInsights({
          contextString: contextStringOverride,
          onChunk
        });
      });

      sendToRenderer('ai-stream-end', { actionId: 'insights' });
      return { success: true, insights };
    } catch (error) {
      console.error('Error getting insights:', error);
      sendToRenderer('ai-stream-end', { actionId: 'insights' });
      return { success: false, error: mapGeminiErrorMessage(error, 'Failed to get conversation insights') };
    }
  });

  ipcMain.handle('clear-conversation-history', async () => {
    const geminiService = geminiRuntime.getService();

    try {
      assemblyAiService.resetSttHistoryBuffers();
      if (geminiService) {
        geminiService.clearHistory();
      }

      chatContext = [];
      return { success: true };
    } catch (error) {
      console.error('Error clearing history:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-conversation-history', async () => {
    const geminiService = geminiRuntime.getService();

    try {
      if (!geminiService) {
        return { success: true, history: [] };
      }

      return { success: true, history: geminiService.conversationHistory };
    } catch (error) {
      console.error('Error getting history:', error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = {
  registerAssistantIpc
};
