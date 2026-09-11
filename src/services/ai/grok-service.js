// ============================================================================
// GROK AI SERVICE - Open-Cluely AI Assistant
// ============================================================================
// Uses xAI's OpenAI-compatible Chat Completions API (https://api.x.ai/v1).
// Implements the same public interface as GeminiService so the runtime
// can swap providers transparently. Image parts are forwarded as data URLs.
// ============================================================================

const {
  resolveGrokModel,
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

const DEFAULT_GROK_BASE_URL = 'https://api.x.ai/v1';
const GROK_REQUEST_TIMEOUT_MS = 360000;

class GrokService {
  constructor(apiKey, options = {}) {
    this.apiKey = String(apiKey || '').trim();
    this.baseUrl = String(options.baseUrl || DEFAULT_GROK_BASE_URL).replace(/\/+$/, '');
    this.modelName = resolveGrokModel(options.modelName);
    this.programmingLanguage = resolveProgrammingLanguage(options.programmingLanguage);
    this.model = this.modelName;

    this.requestQueue = [];
    this.lastRequestTime = 0;
    this.minRequestInterval = 500;
    this.maxRetries = 2;
    this.isProcessing = false;

    this.conversationHistory = [];
    this.maxHistoryLength = 20;

    this.dailyTokenCount = 0;
    this.maxDailyTokens = Infinity;
    this.lastResetTime = Date.now();

    console.log('GrokService initialized:', this.modelName);
  }

  updateConfiguration(options = {}) {
    const previousProgrammingLanguage = this.programmingLanguage;
    const nextApiKey = String(options.apiKey ?? this.apiKey ?? '').trim();
    const nextBaseUrl = String(options.baseUrl ?? this.baseUrl).replace(/\/+$/, '');
    const nextModelName = resolveGrokModel(options.modelName ?? this.modelName);
    const nextProgrammingLanguage = resolveProgrammingLanguage(
      options.programmingLanguage ?? this.programmingLanguage
    );

    const apiKeyChanged = nextApiKey !== this.apiKey;
    const modelChanged = nextModelName !== this.modelName;
    const programmingLanguageChanged = nextProgrammingLanguage !== previousProgrammingLanguage;

    this.apiKey = nextApiKey;
    this.baseUrl = nextBaseUrl;
    this.modelName = nextModelName;
    this.model = this.modelName;
    this.programmingLanguage = nextProgrammingLanguage;

    return {
      apiKeyChanged,
      modelChanged,
      programmingLanguageChanged
    };
  }

  isQuotaExhaustedError(error) {
    const message = String(error?.message || '').toLowerCase();
    return (
      message.includes('quota') ||
      message.includes('insufficient credits') ||
      message.includes('credit') ||
      message.includes('rate limit') ||
      message.includes('429') ||
      message.includes('resource_exhausted')
    );
  }

  isAuthenticationError(error) {
    const message = String(error?.message || '').toLowerCase();
    return (
      message.includes('invalid api key') ||
      message.includes('incorrect api key') ||
      message.includes('api key not valid') ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('401') ||
      message.includes('403')
    );
  }

  isRetryableError(error) {
    const message = String(error?.message || '');
    return (
      message.includes('429') ||
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('ECONNRESET') ||
      message.includes('fetch failed')
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
      const userContent = this._buildUserContent(request.data);

      if (typeof request.onChunk === 'function') {
        return await this._chat(userContent, { stream: true, onChunk: request.onChunk, request });
      }

      return await this._chat(userContent, { stream: false });
    } catch (error) {
      console.error(`Grok request error (attempt ${retryCount + 1}):`, error.message);

      if (request._firstChunkSent) {
        throw error;
      }

      if (retryCount < this.maxRetries && this.isRetryableError(error)) {
        const backoffTime = Math.pow(2, retryCount) * 1000;
        console.log(`Retrying Grok request in ${backoffTime}ms...`);
        await new Promise((resolve) => setTimeout(resolve, backoffTime));
        return this._executeRequest(request, retryCount + 1);
      }

      throw error;
    }
  }

  _buildUserContent(data) {
    if (typeof data === 'string') {
      return data;
    }

    if (!Array.isArray(data)) {
      return String(data || '');
    }

    const content = [];

    for (const part of data) {
      if (typeof part === 'string') {
        content.push({ type: 'text', text: part });
        continue;
      }

      if (part?.text) {
        content.push({ type: 'text', text: part.text });
        continue;
      }

      const inline = part?.inlineData;
      if (inline?.data) {
        const mimeType = inline.mimeType || 'image/png';
        content.push({
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${inline.data}`
          }
        });
      }
    }

    if (content.length === 1 && content[0].type === 'text') {
      return content[0].text;
    }

    return content;
  }

  _buildMessages(userContent) {
    return [
      { role: 'system', content: 'You are a helpful AI assistant.' },
      { role: 'user', content: userContent }
    ];
  }

  _extractMessageText(message) {
    const content = message?.content;
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (typeof part === 'string') {
            return part;
          }
          return part?.text || '';
        })
        .join('');
    }

    return '';
  }

  async _chat(userContent, options = {}) {
    if (!this.apiKey) {
      throw new Error('No Grok API key configured. Add it in Settings.');
    }

    const url = `${this.baseUrl}/chat/completions`;
    const stream = Boolean(options.stream);
    const messages = this._buildMessages(userContent);

    console.log(`[Grok API] ${stream ? 'Streaming' : 'Non-streaming'} request started (model: ${this.modelName})`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.modelName,
        messages,
        stream
      }),
      signal: AbortSignal.timeout(GROK_REQUEST_TIMEOUT_MS)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Grok API error ${response.status}: ${errorText}`);
    }

    if (!stream) {
      const result = await response.json();
      const responseText = this._extractMessageText(result.choices?.[0]?.message);
      console.log(`[Grok API] Non-streaming request completed (${responseText.length} chars)`);
      return responseText;
    }

    return this._readSseStream(response, options);
  }

  async _readSseStream(response, options = {}) {
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let chunkIndex = 0;
    const request = options.request || {};

    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) {
          continue;
        }

        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') {
          continue;
        }

        try {
          const parsed = JSON.parse(payload);
          const delta = parsed.choices?.[0]?.delta;
          const content = typeof delta?.content === 'string'
            ? delta.content
            : this._extractMessageText(delta);

          if (content) {
            fullText += content;
            chunkIndex += 1;
            if (!request._firstChunkSent) {
              request._firstChunkSent = true;
            }
            if (typeof options.onChunk === 'function') {
              options.onChunk({ text: content, index: chunkIndex });
            }
          }
        } catch {
          // skip malformed SSE lines
        }
      }
    }

    console.log(`[Grok API] Streaming request completed (${chunkIndex} chunks, ${fullText.length} chars)`);
    return fullText;
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
        onChunk: typeof options.onChunk === 'function' ? options.onChunk : null
      };

      this.requestQueue.push(request);
      this.processQueue();
    });
  }

  async analyzeScreenshots(imageParts, additionalContext = '', options = {}) {
    const contextString = typeof options.contextStringOverride === 'string'
      ? options.contextStringOverride
      : this.getContextString();
    const prompt = buildScreenshotAnalysisPrompt({
      contextString,
      additionalContext,
      programmingLanguage: this.programmingLanguage
    });

    const streamOptions = { onChunk: options.onChunk };
    const result = await this.generateMultimodal([
      { text: prompt },
      ...imageParts
    ], streamOptions);

    this.addToHistory('assistant', `Screenshot analysis: ${result}`);
    return result;
  }

  async analyzeScreenshot(imageBase64, additionalContext = '') {
    return this.analyzeScreenshots(
      [{ inlineData: { mimeType: 'image/png', data: imageBase64 } }],
      additionalContext
    );
  }

  async askAiWithSessionContext(options = {}) {
    const contextString = typeof options.contextString === 'string'
      ? options.contextString
      : this.getContextString();
    const prompt = buildAskAiSessionPrompt({
      contextString,
      transcriptContext: options.transcriptContext || '',
      sessionSummary: options.sessionSummary || '',
      screenshotCount: options.screenshotCount || 0,
      mode: options.mode || 'best-next-answer'
    });

    const streamOptions = { onChunk: options.onChunk };
    const result = await this.generateText(prompt, streamOptions);
    this.addToHistory('assistant', `Ask AI: ${result}`);
    return result;
  }

  async askAiWithSessionContextAndScreenshots(imageParts, options = {}) {
    const contextString = typeof options.contextString === 'string'
      ? options.contextString
      : this.getContextString();
    const prompt = buildAskAiSessionPrompt({
      contextString,
      transcriptContext: options.transcriptContext || '',
      sessionSummary: options.sessionSummary || '',
      screenshotCount: options.screenshotCount || imageParts.length,
      mode: options.mode || 'best-next-answer'
    });

    const streamOptions = { onChunk: options.onChunk };
    const result = await this.generateMultimodal([
      { text: prompt },
      ...imageParts
    ], streamOptions);

    this.addToHistory('assistant', `Ask AI: ${result}`);
    return result;
  }

  async suggestResponse(context, options = {}) {
    const contextString = typeof options.contextString === 'string'
      ? options.contextString
      : this.getContextString();
    const prompt = buildSuggestResponsePrompt({
      contextString,
      context
    });

    const streamOptions = { onChunk: options.onChunk };
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
    const streamOptions = { onChunk: options.onChunk };
    return this.generateText(prompt, streamOptions);
  }

  async generateFollowUpEmail(options = {}) {
    if (this.conversationHistory.length === 0) {
      return 'No conversation history to create email from.';
    }

    const contextString = this.getContextString();
    const prompt = buildFollowUpEmailPrompt({ contextString });
    const streamOptions = { onChunk: options.onChunk };
    return this.generateText(prompt, streamOptions);
  }

  async answerQuestion(question, options = {}) {
    const contextString = this.getContextString();
    const prompt = buildAnswerQuestionPrompt({
      contextString,
      question,
      programmingLanguage: this.programmingLanguage
    });

    const streamOptions = { onChunk: options.onChunk };
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
    const streamOptions = { onChunk: options.onChunk };
    return this.generateText(prompt, streamOptions);
  }
}

module.exports = GrokService;
