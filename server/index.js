import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import {
  buildPrompt,
  calculateDeterministicMatch,
  validateAiAnalysis,
  validateProfiles
} from './matchingEngine.js';

const app = express();
app.set('trust proxy', 1);

const configuredOrigins = (process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const developmentOrigins = process.env.NODE_ENV === 'production'
  ? []
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];
const allowedOrigins = new Set([...configuredOrigins, ...developmentOrigins]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    const error = new Error('Origin is not allowed by CORS.');
    error.code = 'CORS_ORIGIN_DENIED';
    return callback(error);
  }
}));
app.use(express.json({ limit: '20kb' }));

const model = 'models/gemma-4-26b-a4b-it';
const aiRateLimitWindowMs = 60_000;
const aiRateLimitMax = Math.max(1, Number.parseInt(process.env.AI_RATE_LIMIT_MAX || '10', 10) || 10);
const aiRateLimitBuckets = new Map();

function limitAiRequests(req, res, next) {
  const now = Date.now();
  const key = req.ip || 'unknown';
  const existing = aiRateLimitBuckets.get(key);
  const bucket = !existing || existing.resetAt <= now
    ? { count: 0, resetAt: now + aiRateLimitWindowMs }
    : existing;

  bucket.count += 1;
  aiRateLimitBuckets.set(key, bucket);
  res.set('RateLimit-Limit', String(aiRateLimitMax));
  res.set('RateLimit-Remaining', String(Math.max(0, aiRateLimitMax - bucket.count)));
  res.set('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

  if (aiRateLimitBuckets.size > 10_000) aiRateLimitBuckets.clear();
  if (bucket.count <= aiRateLimitMax) return next();

  res.set('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
  return res.status(429).json({
    error: 'Too many AI matching requests. Try again later.',
    code: 'AI_RATE_LIMITED'
  });
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

function deterministicResponse(deterministic) {
  const matches = deterministic.comparisons.filter((item) => item.matches);
  const mismatches = deterministic.comparisons.filter((item) => !item.matches);
  return {
    eligible: deterministic.eligible,
    compatibilityScore: deterministic.compatibilityScore,
    summary: deterministic.compatibilityScore === null
      ? 'More shared profile information is needed for a fair score.'
      : `Deterministic compatibility is ${deterministic.compatibilityScore}%.`,
    strengths: matches.map((item) => `Compatible ${item.field}.`),
    conflicts: mismatches.map((item) => `Different ${item.field}.`),
    questions: deterministic.discussionItems,
    missingInformation: deterministic.missingInformation,
    hardConstraints: deterministic.hardConstraints,
    dealbreakerConflicts: deterministic.dealbreakerConflicts,
    discussionItems: deterministic.discussionItems,
    breakdown: deterministic.comparisons,
    aiGenerated: false
  };
}

async function generateGemmaAnalysis(prompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  const startedAt = performance.now();
  const requestPayload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
      maxOutputTokens: 400,
      thinkingConfig: {
        thinkingLevel: 'minimal'
      }
    }
  };

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY
        },
        body: JSON.stringify(requestPayload),
        signal: controller.signal
      }
    );

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body?.error?.message || `Google API returned HTTP ${response.status}.`);
      error.status = response.status;
      error.apiStatus = body?.error?.status;
      throw error;
    }

    const text = body?.candidates?.[0]?.content?.parts
      ?.filter((part) => part.thought !== true)
      .map((part) => part.text || '')
      .join('');
    if (!text) throw new Error('Gemma returned no text content.');
    if (process.env.GEMMA_DIAGNOSTICS === '1') {
      const candidate = body?.candidates?.[0];
      const usage = body?.usageMetadata || {};
      console.info('Gemma request metrics:', JSON.stringify({
        durationSeconds: Number(((performance.now() - startedAt) / 1000).toFixed(3)),
        requestBytes: Buffer.byteLength(JSON.stringify(requestPayload)),
        responseBytes: Buffer.byteLength(JSON.stringify(body)),
        promptTokenCount: usage.promptTokenCount ?? null,
        candidatesTokenCount: usage.candidatesTokenCount ?? null,
        thoughtsTokenCount: usage.thoughtsTokenCount ?? null,
        totalTokenCount: usage.totalTokenCount ?? null,
        finishReason: candidate?.finishReason ?? null,
        thoughtPartCount: candidate?.content?.parts?.filter((part) => part.thought === true).length ?? 0
      }));
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

function parseGemmaJson(text) {
  const withoutThoughts = text
    .replace(/<\|channel\>thought[\s\S]*?<\|channel\>(?:final)?/gi, '')
    .replace(/<\|think\|>[\s\S]*?<\|\/think\|>/gi, '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();
  const fencedJson = withoutThoughts.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fencedJson || withoutThoughts;
  const candidate = source.slice(source.indexOf('{'), source.lastIndexOf('}') + 1);
  if (!candidate) throw new Error('Gemma did not return a JSON object.');
  return JSON.parse(candidate);
}

function prepareMatch(req, res) {
  const validationError = validateProfiles(req.body);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return null;
  }

  const { seeker, host } = req.body;
  const deterministic = calculateDeterministicMatch(seeker, host);
  return { seeker, host, deterministic };
}

app.post('/api/match/deterministic', (req, res) => {
  const prepared = prepareMatch(req, res);
  if (!prepared) return;
  res.json(deterministicResponse(prepared.deterministic));
});

app.post('/api/match', limitAiRequests, async (req, res) => {
  const prepared = prepareMatch(req, res);
  if (!prepared) return;
  const { seeker, host, deterministic } = prepared;

  if (!deterministic.eligible) {
    return res.json(deterministicResponse(deterministic));
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      error: 'AI matching is not configured. Add GEMINI_API_KEY to server/.env.',
      code: 'AI_NOT_CONFIGURED'
    });
  }

  try {
    const responseText = await generateGemmaAnalysis(
      buildPrompt(seeker, host, deterministic)
    );
    const analysis = validateAiAnalysis(parseGemmaJson(responseText));
    res.json({
      ...deterministicResponse(deterministic),
      ...analysis,
      aiGenerated: true
    });
  } catch (error) {
    console.error('AI request failed:', error.message);
    const unavailableModel =
      error.status === 404 || /not found|not supported|model unavailable/i.test(error.message);
    const timedOut = error.name === 'AbortError' || error.name === 'TimeoutError';
    const invalidResponse = /JSON object|JSON|no text content/i.test(error.message);
    res.status(503).json({
      error: unavailableModel
        ? `The configured model (${model}) is unavailable for this API key.`
        : timedOut
          ? 'The Gemma request timed out after 20 seconds.'
          : invalidResponse
            ? 'Gemma returned an invalid compatibility explanation.'
            : 'Compatibility analysis is temporarily unavailable.',
      code: unavailableModel
        ? 'MODEL_UNAVAILABLE'
        : timedOut
          ? 'AI_REQUEST_TIMEOUT'
          : invalidResponse
            ? 'AI_RESPONSE_INVALID'
            : 'AI_REQUEST_FAILED'
    });
  }
});

app.use((error, _req, res, next) => {
  if (error?.code === 'CORS_ORIGIN_DENIED') {
    return res.status(403).json({ error: 'Origin is not allowed.' });
  }
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ error: 'Request body contains invalid JSON.' });
  }
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body exceeds the 20kb limit.' });
  }
  return next(error);
});

const port = Number(process.env.PORT) || 3001;
const host = '0.0.0.0';
app.listen(port, host, () => console.log(`RoomRoot AI listening on ${host}:${port}`));
