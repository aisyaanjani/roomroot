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
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '20kb' }));

const model = 'models/gemma-4-26b-a4b-it';

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

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1200
          }
        }),
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
      ?.map((part) => part.text || '')
      .join('');
    if (!text) throw new Error('Gemma returned no text content.');
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

function parseGemmaJson(text) {
  const fencedJson = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fencedJson || text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
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

app.post('/api/match', async (req, res) => {
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
    res.status(503).json({
      error: unavailableModel
        ? `The configured model (${model}) is unavailable for this API key.`
        : timedOut
          ? 'The Gemma request timed out after 20 seconds.'
          : 'Compatibility analysis is temporarily unavailable.',
      code: unavailableModel
        ? 'MODEL_UNAVAILABLE'
        : timedOut
          ? 'AI_REQUEST_TIMEOUT'
          : 'AI_REQUEST_FAILED'
    });
  }
});

app.use((error, _req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ error: 'Request body contains invalid JSON.' });
  }
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body exceeds the 20kb limit.' });
  }
  return next(error);
});

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => console.log(`RoomRoot AI running at http://localhost:${port}`));
