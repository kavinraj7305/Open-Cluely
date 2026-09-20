// ============================================================================
// AWS BEDROCK AI SERVICE - Open-Cluely AI Assistant
// ============================================================================
// Uses Bedrock Runtime Converse with a long-term Bedrock API key
// (Authorization: Bearer / AWS_BEARER_TOKEN_BEDROCK).
// Implements the same public interface as GeminiService / GroqService.
// ============================================================================

const {
  resolveBedrockModel,
  resolveBedrockRegion,
  resolveProgrammingLanguage
} = require('../../config');
const {
  buildAnswerQuestionPrompt,
  buildAskAiSessionPrompt,
  buildFollowUpEmailPrompt,
  buildInsightsPrompt,
  buildMeetingNotesPrompt,
  buildScreenshotAnalysisPrompt,
  buildSuggestResponsePrompt
} = require('./prompts');

const {
  createRequestId,
  clip,
  preview,
  appendAiRequestLog,
  logAiEvent
} = require('../debug/ai-request-log');

const BEDROCK_REQUEST_TIMEOUT_MS = 120000;
const BEDROCK_MAX_OUTPUT_TOKENS = 2048;
const BEDROCK_MAX_IMAGES = 1;

class BedrockService {
  constructor(apiKey, options = {}) {
    this.apiKey = String(apiKey || '').trim();
    this.modelName = resolveBedrockModel(options.modelName);
    this.region = resolveBedrockRegion(options.region);
    this.programmingLanguage = resolveProgrammingLanguage(options.programmingLanguage);
    this.model = this.modelName;

    this.requestQueue = [];
    this.lastRequestTime = 0;
    this.minRequestInterval = 250;
    this.maxRetries = 2;
    this.isProcessing = false;

    this.conversationHistory = [];
    this.maxHistoryLength = 20;

    this.dailyTokenCount = 0;
    this.maxDailyTokens = Infinity;
    this.lastResetTime = Date.now();

    console.log('BedrockService initialized:', this.modelName, this.region);
  }

  updateConfiguration(options = {}) {
    const previousProgrammingLanguage = this.programmingLanguage;
    const nextApiKey = String(options.apiKey ?? this.apiKey ?? '').trim();
    const nextModelName = resolveBedrockModel(options.modelName ?? this.modelName);
    const nextRegion = resolveBedrockRegion(options.region ?? this.region);
    const nextProgrammingLanguage = resolveProgrammingLanguage(
      options.programmingLanguage ?? this.programmingLanguage
    );

    const apiKeyChanged = nextApiKey !== this.apiKey;
    const modelChanged = nextModelName !== this.modelName;
    const regionChanged = nextRegion !== this.region;
    const programmingLanguageChanged = nextProgrammingLanguage !== previousProgrammingLanguage;

    this.apiKey = nextApiKey;
    this.modelName = nextModelName;
    this.model = this.modelName;
    this.region = nextRegion;
    this.programmingLanguage = nextProgrammingLanguage;

    return {
      apiKeyChanged,
      modelChanged,
      regionChanged,
      programmingLanguageChanged
    };
  }

  isQuotaExhaustedError(error) {
    const message = String(error?.message || '').toLowerCase();
    if (this.isRateLimitError(error)) {
      return false;
    }

    return (
      message.includes('throttl') ||
      message.includes('quota') ||
      message.includes('limit exceeded') ||
      message.includes('accessdenied')
    );
  }

  isRateLimitError(error) {
    const message = String(error?.message || '').toLowerCase();
    return (
      message.includes('throttling') ||
      message.includes('too many requests') ||
      message.includes('rate exceeded') ||
      message.includes('429')
    );
  }

  isAuthenticationError(error) {
    const message = String(error?.message || '').toLowerCase();
    return (
      message.includes('unrecognizedclient') ||
      message.includes('invalidtoken') ||
      message.includes('expiredtoken') ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('401') ||
      message.includes('403')
    );
  }

  isRetryableError(error) {
    if (this.isRateLimitError(error)) {
      return false;
    }

    const message = String(error?.message || '');
    return (
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('ECONNRESET') ||
      message.includes('fetch failed')
    );
  }

  modelSupportsImages() {
    const id = String(this.modelName || '').toLowerCase();
    return (
      id.includes('claude') ||
      id.includes('nova') ||
      id.includes('pixtral') ||
      id.includes('llama3-2') ||
      id.includes('llama-3.2') ||
      id.includes('gpt-4o') ||
      id.includes('qwen') && id.includes('vl')
    );
  }

  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();

      try {
        await this.waitForRateLimit();
        const result = await this._executeRequest(request);
        request.resolve(result);
      } catch (error) {
        request.reject(error);
      }
    }

    this.isProcessing = false;
  }

  async _executeRequest(request, retryCount = 0) {
    try {
      const content = this._buildConverseContent(request.data);

      if (typeof request.onChunk === 'function') {
        return await this._converse(content, { onChunk: request.onChunk, request, requestId: request.requestId });
      }

      return await this._converse(content, { request, requestId: request.requestId });
    } catch (error) {
      console.error(`Bedrock request error (attempt ${retryCount + 1}):`, error.message);

      if (request._firstChunkSent) {
        throw error;
      }

      if (retryCount < this.maxRetries && this.isRetryableError(error)) {
        const backoffTime = Math.pow(2, retryCount) * 1000;
        console.log(`Retrying Bedrock request in ${backoffTime}ms...`);
        await new Promise((resolve) => setTimeout(resolve, backoffTime));
        return this._executeRequest(request, retryCount + 1);
      }

      throw error;
    }
  }

  _buildConverseContent(data) {
    if (typeof data === 'string') {
      return [{ text: data }];
    }

    if (!Array.isArray(data)) {
      return [{ text: String(data || '') }];
    }

    const content = [];
    const imageParts = [];

    for (const part of data) {
      if (typeof part === 'string') {
        content.push({ text: part });
        continue;
      }

      if (part?.text) {
        content.push({ text: part.text });
        continue;
      }

      const inline = part?.inlineData;
      if (inline?.data) {
        const mimeType = String(inline.mimeType || 'image/png').toLowerCase();
        const format = mimeType.includes('jpeg') || mimeType.includes('jpg')
          ? 'jpeg'
          : mimeType.includes('gif')
            ? 'gif'
            : mimeType.includes('webp')
              ? 'webp'
              : 'png';
        imageParts.push({
          image: {
            format,
            source: { bytes: inline.data }
          }
        });
      }
    }

    if (this.modelSupportsImages()) {
      content.push(...imageParts.slice(-BEDROCK_MAX_IMAGES));
    } else if (imageParts.length > 0 && !this._contentHasOcr(content)) {
      content.push({
        text: 'Note: screenshots were captured, but this Bedrock model cannot read images. If no SCREEN OCR block is present, answer from typed chat notes and transcript only.'
      });
    }

    if (content.length === 0) {
      return [{ text: '' }];
    }

    return content;
  }

  _contentHasOcr(content) {
    return content.some((part) => String(part?.text || '').includes('SCREEN OCR'));
  }

  _buildOcrBlock(ocrText) {
    const text = String(ocrText || '').trim();
    if (!text) {
      return null;
    }

    return {
      text: `=== SCREEN OCR (treat this as the screenshot contents; this is the question on screen) ===\n${text}`
    };
  }

  _extractOutputText(result) {
    const blocks = result?.output?.message?.content;
    if (!Array.isArray(blocks)) {
      return '';
    }

    return blocks
      .map((block) => (typeof block?.text === 'string' ? block.text : ''))
      .join('');
  }

  async _converse(content, options = {}) {
    if (!this.apiKey) {
      throw new Error('No Bedrock API key configured. Add it in Settings.');
    }

    const requestId = options.requestId || options.request?.requestId || createRequestId('bedrock');
    const encodedModel = encodeURIComponent(this.modelName);
    const url = `https://bedrock-runtime.${this.region}.amazonaws.com/model/${encodedModel}/converse`;
    const sentText = Array.isArray(content)
      ? content.map((block) => (typeof block?.text === 'string' ? block.text : '')).filter(Boolean).join('\n\n')
      : '';

    logAiEvent(requestId, `Bedrock converse start model=${this.modelName} region=${this.region} sentChars=${sentText.length}`);
    logAiEvent(requestId, `Bedrock payload preview: ${preview(sentText)}`);
    console.log(`[Bedrock API] Converse request started (model: ${this.modelName}, region: ${this.region})`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content
          }
        ],
        ...(options.includeSystem === false
          ? {}
          : { system: [{ text: 'You are a helpful AI assistant for technical interviews. Be concise and accurate.' }] }),
        inferenceConfig: {
          maxTokens: BEDROCK_MAX_OUTPUT_TOKENS,
          temperature: 0.3
        }
      }),
      signal: AbortSignal.timeout(BEDROCK_REQUEST_TIMEOUT_MS)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      const combined = `${response.status} ${errorText}`.toLowerCase();
      if (options.includeSystem !== false && combined.includes('system')) {
        console.log('Bedrock: retrying without a separate system prompt');
        return this._converse(content, { ...options, includeSystem: false });
      }
      throw new Error(`Bedrock API error ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    const responseText = this._extractOutputText(result);
    console.log(`[Bedrock API] Converse request completed (${responseText.length} chars)`);
    logAiEvent(requestId, `Bedrock converse done ${responseText.length} chars: ${preview(responseText)}`);
    appendAiRequestLog({
      requestId,
      action: 'bedrock-converse',
      status: 'ok',
      provider: 'bedrock',
      model: this.modelName,
      region: this.region,
      sentChars: sentText.length,
      sentText: clip(sentText),
      responseChars: responseText.length,
      responseText: clip(responseText)
    });

    if (typeof options.onChunk === 'function' && responseText) {
      this._emitFakeStream(responseText, options);
    }

    return responseText;
  }

  _emitFakeStream(text, options = {}) {
    const request = options.request || {};
    const chunkSize = 64;
    let index = 0;

    for (let offset = 0; offset < text.length; offset += chunkSize) {
      const piece = text.slice(offset, offset + chunkSize);
      index += 1;
      if (!request._firstChunkSent) {
        request._firstChunkSent = true;
      }
      options.onChunk({ text: piece, index });
    }
  }

  addToHistory(role, content) {
    this.conversationHistory.push({ role, content });

    if (this.conversationHistory.length > this.maxHistoryLength) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
    }
  }

  clearHistory() {
    this.conversationHistory = [];
  }

  getContextString() {
    return this.conversationHistory
      .map((entry) => `${entry.role}: ${entry.content}`)
      .join('\n\n');
  }

  async generateText(prompt, options = {}) {
    return new Promise((resolve, reject) => {
      const request = {
        type: 'text',
        data: prompt,
        resolve,
        reject,
        requestId: options.requestId || null,
        onChunk: typeof options.onChunk === 'function' ? options.onChunk : null
      };

      this.requestQueue.push(request);
      this.processQueue();
    });
  }

  async generateMultimodal(parts, options = {}) {
    return new Promise((resolve, reject) => {
      const request = {
        type: 'multimodal',
        data: parts,
        resolve,
        reject,
        requestId: options.requestId || null,
        onChunk: typeof options.onChunk === 'function' ? options.onChunk : null
      };

      this.requestQueue.push(request);
      this.processQueue();
    });
  }

  async analyzeScreenshots(imageParts, additionalContext = '', options = {}) {
    const prompt = buildScreenshotAnalysisPrompt({
      contextString: '',
      additionalContext: '',
      programmingLanguage: this.programmingLanguage,
      screenshotCount: 1,
      ocrText: options.ocrText || ''
    });

    const streamOptions = { onChunk: options.onChunk, requestId: options.requestId };
    return this.generateText(prompt, streamOptions);
  }

  async analyzeScreenshot(imageBase64, additionalContext = '') {
    return this.analyzeScreenshots(
      [{ inlineData: { mimeType: 'image/png', data: imageBase64 } }],
      additionalContext
    );
  }

  async askAiWithSessionContext(options = {}) {
    const prompt = buildAskAiSessionPrompt({
      contextString: '',
      transcriptContext: '',
      sessionSummary: '',
      screenshotCount: options.screenshotCount || (options.ocrText ? 1 : 0),
      programmingLanguage: this.programmingLanguage,
      answerMode: options.answerMode || options.mode,
      ocrText: options.ocrText || ''
    });

    const streamOptions = { onChunk: options.onChunk, requestId: options.requestId };
    return this.generateText(prompt, streamOptions);
  }

  async askAiWithSessionContextAndScreenshots(imageParts, options = {}) {
    const prompt = buildAskAiSessionPrompt({
      contextString: '',
      transcriptContext: '',
      sessionSummary: '',
      screenshotCount: 1,
      programmingLanguage: this.programmingLanguage,
      answerMode: options.answerMode || options.mode,
      ocrText: options.ocrText || ''
    });
    const parts = Array.isArray(imageParts) ? imageParts.slice(-1) : [];
    const streamOptions = { onChunk: options.onChunk, requestId: options.requestId };
    if (parts.length === 0) {
      return this.generateText(prompt, streamOptions);
    }
    return this.generateMultimodal([{ text: prompt }, ...parts], streamOptions);
  }

  async suggestResponse(context, options = {}) {
    const contextString = typeof options.contextString === 'string'
      ? options.contextString
      : this.getContextString();
    const prompt = buildSuggestResponsePrompt({
      contextString,
      context
    });

    const streamOptions = { onChunk: options.onChunk, requestId: options.requestId };
    return this.generateText(prompt, streamOptions);
  }

  async generateMeetingNotes(options = {}) {
    const contextString = typeof options.contextString === 'string'
      ? options.contextString
      : this.getContextString();
    if (!contextString.trim()) {
      return 'No conversation history to summarize.';
    }
    const prompt = buildMeetingNotesPrompt({ contextString });
    const streamOptions = { onChunk: options.onChunk, requestId: options.requestId };
    return this.generateText(prompt, streamOptions);
  }

  async generateFollowUpEmail(options = {}) {
    if (this.conversationHistory.length === 0) {
      return 'No conversation history to create email from.';
    }

    const contextString = this.getContextString();
    const prompt = buildFollowUpEmailPrompt({ contextString });
    const streamOptions = { onChunk: options.onChunk, requestId: options.requestId };
    return this.generateText(prompt, streamOptions);
  }

  async answerQuestion(question, options = {}) {
    const contextString = this.getContextString();
    const prompt = buildAnswerQuestionPrompt({
      contextString,
      question,
      programmingLanguage: this.programmingLanguage
    });

    const streamOptions = { onChunk: options.onChunk, requestId: options.requestId };
    const result = await this.generateText(prompt, streamOptions);
    this.addToHistory('user', question);
    this.addToHistory('assistant', result);
    return result;
  }

  async getConversationInsights(options = {}) {
    const contextString = typeof options.contextString === 'string'
      ? options.contextString
      : this.getContextString();
    if (!contextString.trim()) {
      return 'Not enough conversation data for insights.';
    }
    const prompt = buildInsightsPrompt({ contextString });
    const streamOptions = { onChunk: options.onChunk, requestId: options.requestId };
    return this.generateText(prompt, streamOptions);
  }
}

module.exports = BedrockService;
