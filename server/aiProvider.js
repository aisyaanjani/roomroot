const GOOGLE_MODEL = 'models/gemma-4-26b-a4b-it';
const OPENROUTER_MODEL = 'google/gemma-4-26b-a4b-it:free';

export class AiProviderError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'AiProviderError';
    this.provider = details.provider;
    this.status = details.status;
    this.apiStatus = details.apiStatus;
  }
}

export function getAiConfiguration(env = process.env) {
  const provider = (env.AI_PROVIDER || 'google').trim().toLowerCase();

  if (provider === 'google') {
    const model = env.AI_MODEL || GOOGLE_MODEL;
    if (model !== GOOGLE_MODEL) throw new Error(`Unsupported Google model: ${model}`);
    return {
      provider,
      model,
      apiKey: env.GEMINI_API_KEY,
      requiredKey: 'GEMINI_API_KEY'
    };
  }

  if (provider === 'openrouter') {
    const model = env.AI_MODEL || OPENROUTER_MODEL;
    if (model !== OPENROUTER_MODEL) throw new Error(`Unsupported OpenRouter model: ${model}`);
    return {
      provider,
      model,
      apiKey: env.OPENROUTER_API_KEY,
      requiredKey: 'OPENROUTER_API_KEY'
    };
  }

  throw new Error(`Unsupported AI_PROVIDER: ${provider}`);
}

function googleRequest(prompt, configuration) {
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/${configuration.model}:generateContent`,
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': configuration.apiKey
    },
    payload: {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
        maxOutputTokens: 400,
        thinkingConfig: { thinkingLevel: 'minimal' }
      }
    },
    extractText(body) {
      return body?.candidates?.[0]?.content?.parts
        ?.filter((part) => part.thought !== true)
        .map((part) => part.text || '')
        .join('');
    },
    metrics(body) {
      const candidate = body?.candidates?.[0];
      const usage = body?.usageMetadata || {};
      return {
        promptTokenCount: usage.promptTokenCount ?? null,
        candidatesTokenCount: usage.candidatesTokenCount ?? null,
        thoughtsTokenCount: usage.thoughtsTokenCount ?? null,
        totalTokenCount: usage.totalTokenCount ?? null,
        finishReason: candidate?.finishReason ?? null
      };
    }
  };
}

function openRouterRequest(prompt, configuration) {
  return {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${configuration.apiKey}`,
      'HTTP-Referer': 'https://github.com/aisyaanjani/roomroot',
      'X-Title': 'RoomRoot'
    },
    payload: {
      model: configuration.model,
      provider: { max_price: { prompt: 0, completion: 0 } },
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 400
    },
    extractText(body) {
      return body?.choices?.[0]?.message?.content;
    },
    metrics(body) {
      const usage = body?.usage || {};
      return {
        promptTokenCount: usage.prompt_tokens ?? null,
        candidatesTokenCount: usage.completion_tokens ?? null,
        thoughtsTokenCount: usage.completion_tokens_details?.reasoning_tokens ?? null,
        totalTokenCount: usage.total_tokens ?? null,
        finishReason: body?.choices?.[0]?.finish_reason ?? null
      };
    }
  };
}

export async function generateGemmaAnalysis(prompt, options = {}) {
  const configuration = options.configuration || getAiConfiguration(options.env);
  const fetchImpl = options.fetchImpl || fetch;
  // Validate even explicitly supplied configurations before any network request.
  const exactFreeModel = configuration.provider === 'google'
    ? configuration.model === GOOGLE_MODEL
    : configuration.provider === 'openrouter' && configuration.model === OPENROUTER_MODEL;
  if (!exactFreeModel) throw new Error('Only an approved exact Gemma 4 model is allowed.');
  const request = configuration.provider === 'google'
    ? googleRequest(prompt, configuration)
    : openRouterRequest(prompt, configuration);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);
  const startedAt = performance.now();
  const serializedPayload = JSON.stringify(request.payload);

  try {
    let response;
    let body;
    const retryDelays = configuration.provider === 'google' ? (options.retryDelaysMs || [350, 900]) : [];
    for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
      response = await fetchImpl(request.url, {
        method: 'POST',
        headers: request.headers,
        body: serializedPayload,
        signal: controller.signal
      });
      body = await response.json().catch(() => ({}));
      if (response.ok) break;
      if (response.status === 429 && attempt < retryDelays.length) {
        await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
        continue;
      }
      throw new AiProviderError(`${configuration.provider} request failed.`, {
        provider: configuration.provider,
        status: response.status,
        apiStatus: body?.error?.status || body?.error?.code
      });
    }

    const text = request.extractText(body);
    if (!text || typeof text !== 'string') throw new Error('Gemma returned no text content.');

    if (process.env.GEMMA_DIAGNOSTICS === '1') {
      console.info('Gemma request metrics:', JSON.stringify({
        provider: configuration.provider,
        model: configuration.model,
        durationSeconds: Number(((performance.now() - startedAt) / 1000).toFixed(3)),
        requestBytes: Buffer.byteLength(serializedPayload),
        responseBytes: Buffer.byteLength(JSON.stringify(body)),
        ...request.metrics(body)
      }));
    }

    return text;
  } finally {
    clearTimeout(timeout);
  }
}

export function parseGemmaJson(text) {
  const withoutThoughts = text
    .replace(/<\|channel\>thought[\s\S]*?<\|channel\>(?:final)?/gi, '')
    .replace(/<\|think\|>[\s\S]*?<\|\/think\|>/gi, '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();
  const fencedJson = withoutThoughts.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fencedJson || withoutThoughts;
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Gemma did not return a JSON object.');
  return JSON.parse(source.slice(start, end + 1));
}

export function describeAiFailure(error, configuration) {
  const status = error?.status;
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
    return { status: 503, error: 'The Gemma request timed out after 20 seconds.', code: 'AI_REQUEST_TIMEOUT' };
  }
  if (status === 401) {
    return { status: 503, error: 'The configured AI provider credentials were rejected.', code: 'AI_AUTH_FAILED' };
  }
  if (status === 402) {
    return { status: 503, error: 'The free AI provider route is unavailable because the account requires credits.', code: 'AI_PAYMENT_REQUIRED' };
  }
  if (status === 403) {
    return { status: 503, error: 'The configured AI provider denied access to this model.', code: 'AI_ACCESS_DENIED' };
  }
  if (status === 404) {
    return {
      status: 503,
      error: `The configured model (${configuration.model}) is unavailable for this API key.`,
      code: 'MODEL_UNAVAILABLE'
    };
  }
  if (status === 429) {
    return { status: 503, error: 'Free AI is briefly busy. Wait a moment and refresh—no charge was attempted.', code: 'AI_PROVIDER_RATE_LIMITED' };
  }
  if (status >= 500) {
    return { status: 503, error: 'The AI provider is temporarily unavailable.', code: 'AI_PROVIDER_UNAVAILABLE' };
  }
  if (/JSON object|JSON|no text content/i.test(error?.message || '')) {
    return { status: 503, error: 'Gemma returned an invalid compatibility explanation.', code: 'AI_RESPONSE_INVALID' };
  }
  return { status: 503, error: 'Compatibility analysis is temporarily unavailable.', code: 'AI_REQUEST_FAILED' };
}

export const AI_MODELS = {
  google: GOOGLE_MODEL,
  openrouter: OPENROUTER_MODEL
};
