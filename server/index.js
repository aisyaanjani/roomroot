import 'dotenv/config';
import { createHash } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import {
  describeAiFailure,
  generateGemmaAnalysis,
  getAiConfiguration,
  parseGemmaJson
} from './aiProvider.js';
import {
  buildPrompt,
  calculateDeterministicMatch,
  deterministicResponse,
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

const aiRateLimitWindowMs = 60_000;
const aiRateLimitMax = Math.max(1, Number.parseInt(process.env.AI_RATE_LIMIT_MAX || '10', 10) || 10);
const aiRateLimitBuckets = new Map();
const aiResponseCache = new Map();
const aiCacheTtlMs = 15 * 60_000;
const aiCacheMaxEntries = 100;

function aiCacheKey(seeker, host) {
  return createHash('sha256').update(JSON.stringify({ seeker, host })).digest('hex');
}

function readAiCache(key) {
  const cached = aiResponseCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    aiResponseCache.delete(key);
    return null;
  }
  return cached.value;
}

function writeAiCache(key, value) {
  if (aiResponseCache.size >= aiCacheMaxEntries) {
    aiResponseCache.delete(aiResponseCache.keys().next().value);
  }
  aiResponseCache.set(key, { value, expiresAt: Date.now() + aiCacheTtlMs });
}

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

  const cacheKey = aiCacheKey(seeker, host);
  const cached = readAiCache(cacheKey);
  if (cached) {
    res.set('X-RoomRoot-AI-Cache', 'HIT');
    return res.json(cached);
  }

  let aiConfiguration;
  try {
    aiConfiguration = getAiConfiguration();
  } catch (error) {
    return res.status(503).json({ error: error.message, code: 'AI_NOT_CONFIGURED' });
  }

  if (!aiConfiguration.apiKey) {
    return res.status(503).json({
      error: `AI matching is not configured. Add ${aiConfiguration.requiredKey} to the server environment.`,
      code: 'AI_NOT_CONFIGURED'
    });
  }

  try {
    const responseText = await generateGemmaAnalysis(
      buildPrompt(seeker, host, deterministic),
      { configuration: aiConfiguration }
    );
    const analysis = validateAiAnalysis(parseGemmaJson(responseText));
    const result = {
      ...deterministicResponse(deterministic),
      ...analysis,
      aiGenerated: true
    };
    writeAiCache(cacheKey, result);
    res.set('X-RoomRoot-AI-Cache', 'MISS');
    res.json(result);
  } catch (error) {
    console.error('AI request failed:', JSON.stringify({
      provider: aiConfiguration.provider,
      status: error.status ?? null,
      apiStatus: error.apiStatus ?? null,
      type: error.name
    }));
    const failure = describeAiFailure(error, aiConfiguration);
    res.status(failure.status).json({ error: failure.error, code: failure.code });
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
