import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AI_MODELS,
  describeAiFailure,
  generateGemmaAnalysis,
  getAiConfiguration,
  parseGemmaJson
} from '../aiProvider.js';

const openRouterConfiguration = () => getAiConfiguration({
  AI_PROVIDER: 'openrouter',
  OPENROUTER_API_KEY: 'test-openrouter-key'
});
const googleConfiguration = () => getAiConfiguration({
  AI_PROVIDER: 'google',
  GEMINI_API_KEY: 'test-google-key'
});

test('defaults to the exact free Google Gemma provider', () => {
  const configuration = getAiConfiguration({});
  assert.equal(configuration.provider, 'google');
  assert.equal(configuration.model, 'models/gemma-4-26b-a4b-it');
  assert.equal(configuration.requiredKey, 'GEMINI_API_KEY');
  assert.equal(AI_MODELS.google, configuration.model);
});

test('selects the exact OpenRouter free Gemma 4 model', () => {
  const configuration = openRouterConfiguration();
  assert.equal(configuration.provider, 'openrouter');
  assert.equal(configuration.model, 'google/gemma-4-26b-a4b-it:free');
  assert.equal(configuration.requiredKey, 'OPENROUTER_API_KEY');
  assert.equal(AI_MODELS.openrouter, configuration.model);
});

test('reports the required key without exposing a missing credential', () => {
  const configuration = getAiConfiguration({ AI_PROVIDER: 'openrouter' });
  assert.equal(configuration.apiKey, undefined);
  assert.equal(configuration.requiredKey, 'OPENROUTER_API_KEY');
});

test('rejects unsupported AI providers', () => {
  assert.throws(
    () => getAiConfiguration({ AI_PROVIDER: 'unknown' }),
    /Unsupported AI_PROVIDER/
  );
});

test('rejects any paid or substitute OpenRouter model', () => {
  assert.throws(
    () => getAiConfiguration({
      AI_PROVIDER: 'openrouter',
      AI_MODEL: 'google/gemma-4-26b-a4b-it',
      OPENROUTER_API_KEY: 'test-openrouter-key'
    }),
    /Unsupported OpenRouter model/
  );
});

test('OpenRouter uses its chat endpoint and returns only model content', async () => {
  let capturedUrl;
  let capturedRequest;
  const text = await generateGemmaAnalysis('fictional prompt', {
    configuration: openRouterConfiguration(),
    fetchImpl: async (url, request) => {
      capturedUrl = url;
      capturedRequest = request;
      return {
        ok: true,
        json: async () => ({
          choices: [{
            finish_reason: 'stop',
            message: { content: '{"summary":"Compatible","strengths":[],"conflicts":[],"questions":[]}' }
          }],
          usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 }
        })
      };
    }
  });

  assert.equal(capturedUrl, 'https://openrouter.ai/api/v1/chat/completions');
  const payload = JSON.parse(capturedRequest.body);
  assert.equal(payload.model, 'google/gemma-4-26b-a4b-it:free');
  assert.equal(payload.messages[0].content, 'fictional prompt');
  assert.deepEqual(payload.response_format, { type: 'json_object' });
  assert.equal(payload.max_tokens, 400);
  assert.deepEqual(payload.provider.max_price, { prompt: 0, completion: 0 });
  assert.equal(payload.models, undefined);
  assert.match(capturedRequest.headers.Authorization, /^Bearer /);
  assert.match(text, /"summary":"Compatible"/);
});

test('Google uses the Gemini API Gemma endpoint and returns only final model content', async () => {
  let capturedUrl;
  let capturedRequest;
  const text = await generateGemmaAnalysis('fictional prompt', {
    configuration: googleConfiguration(),
    fetchImpl: async (url, request) => {
      capturedUrl = url;
      capturedRequest = request;
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [
            { thought: true, text: 'hidden reasoning' },
            { text: '{"summary":"Compatible","strengths":[],"conflicts":[],"questions":[]}' }
          ] }, finishReason: 'STOP' }],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 8, totalTokenCount: 18 }
        })
      };
    }
  });

  assert.equal(capturedUrl, 'https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent');
  const payload = JSON.parse(capturedRequest.body);
  assert.equal(payload.contents[0].parts[0].text, 'fictional prompt');
  assert.equal(payload.generationConfig.responseMimeType, 'application/json');
  assert.equal(payload.generationConfig.maxOutputTokens, 400);
  assert.equal(capturedRequest.headers['x-goog-api-key'], 'test-google-key');
  assert.doesNotMatch(text, /hidden reasoning/);
  assert.match(text, /"summary":"Compatible"/);
});

test('parses JSON after removing thought blocks and markdown fences', () => {
  const parsed = parseGemmaJson('<think>hidden</think>```json\n{"summary":"Valid","strengths":[],"conflicts":[],"questions":[]}\n```');
  assert.equal(parsed.summary, 'Valid');
});

test('rejects invalid generated JSON', () => {
  assert.throws(() => parseGemmaJson('This is not JSON.'), /JSON object/);
  assert.throws(() => parseGemmaJson('{not valid JSON}'), /JSON/);
});

test('classifies provider authentication, payment, access, model, rate, and server errors', () => {
  const configuration = openRouterConfiguration();
  const cases = [
    [401, 'AI_AUTH_FAILED'],
    [402, 'AI_PAYMENT_REQUIRED'],
    [403, 'AI_ACCESS_DENIED'],
    [404, 'MODEL_UNAVAILABLE'],
    [429, 'AI_PROVIDER_RATE_LIMITED'],
    [500, 'AI_PROVIDER_UNAVAILABLE']
  ];
  for (const [status, code] of cases) {
    assert.equal(describeAiFailure({ status }, configuration).code, code);
  }
});

test('surfaces OpenRouter HTTP status without exposing its response body', async () => {
  await assert.rejects(
    generateGemmaAnalysis('fictional prompt', {
      configuration: openRouterConfiguration(),
      fetchImpl: async () => ({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'sensitive upstream detail', code: 429 } })
      })
    }),
    (error) => error.status === 429 && !error.message.includes('sensitive upstream detail')
  );
});

test('cancels a provider request when the timeout expires', async () => {
  await assert.rejects(
    generateGemmaAnalysis('fictional prompt', {
      configuration: openRouterConfiguration(),
      timeoutMs: 5,
      fetchImpl: async (_url, request) => new Promise((_resolve, reject) => {
        request.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      })
    }),
    (error) => describeAiFailure(error, openRouterConfiguration()).code === 'AI_REQUEST_TIMEOUT'
  );
});

test('rejects substitute Google and injected paid configurations before fetching', async () => {
  assert.throws(() => getAiConfiguration({ AI_PROVIDER: 'google', AI_MODEL: 'gemini-4-argon' }), /Unsupported Google model/);
  for (const configuration of [
    { provider: 'google', model: 'models/gemini-4-argon' },
    { provider: 'openrouter', model: 'google/gemma-4-26b-a4b-it' },
  ]) {
    await assert.rejects(generateGemmaAnalysis('test', {
      configuration,
      fetchImpl: () => assert.fail('Must not contact a provider'),
    }), /Only an approved exact Gemma 4/);
  }
});
