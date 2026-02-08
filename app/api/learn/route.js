import { NextResponse } from "next/server";

export const runtime = "nodejs";

const API_BASE_URL = "https://generativelanguage.googleapis.com/v1";
const PREFERRED_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-1.0-pro"
];
const MODEL_CACHE_TTL_MS = 60 * 60 * 1000;
let cachedModelName = null;
let cachedModelAt = 0;
const RESPONSE_CACHE_TTL_MS = 60 * 60 * 1000;
const responseCache = new Map();

const LEVEL_LABELS = {
  0: "Starting from zero",
  1: "Basic familiarity",
  2: "Intermediate",
  3: "Advanced / Review"
};

async function listModels(apiKey) {
  const response = await fetch(`${API_BASE_URL}/models?key=${apiKey}`);
  if (!response.ok) {
    throw new Error(`List models failed: ${response.status}`);
  }
  const data = await response.json();
  return data?.models || [];
}

async function pickModelName(apiKey) {
  try {
    const models = await listModels(apiKey);
    const available = models.filter((model) =>
      Array.isArray(model.supportedGenerationMethods)
        ? model.supportedGenerationMethods.includes("generateContent")
        : false
    );
    if (!available.length) return PREFERRED_MODELS[0];

    const normalize = (name) =>
      name?.startsWith("models/") ? name.slice("models/".length) : name;
    const availableNames = available.map((model) => normalize(model.name));

    for (const preferred of PREFERRED_MODELS) {
      if (availableNames.includes(preferred)) return preferred;
    }
    return availableNames[0];
  } catch (error) {
    console.warn("Unable to list models:", error);
    return PREFERRED_MODELS[0];
  }
}

async function getModelName(apiKey) {
  if (cachedModelName && Date.now() - cachedModelAt < MODEL_CACHE_TTL_MS) {
    return cachedModelName;
  }
  const modelName = await pickModelName(apiKey);
  cachedModelName = modelName;
  cachedModelAt = Date.now();
  return modelName;
}

async function generateContent(apiKey, modelName, prompt) {
  const response = await fetch(
    `${API_BASE_URL}/models/${modelName}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      })
    }
  );

  if (!response.ok) {
    let errorMessage = `AI request failed: ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody?.error?.message) {
        errorMessage = errorBody.error.message;
      }
    } catch {
      // Use default message.
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

function buildPrompt({ course, level, topic }) {
  const levelLabel = LEVEL_LABELS[level] || LEVEL_LABELS[0];
  return `
You are an expert tutor. Build a full learning path to take a student from their current knowledge level to exam-ready for the given topic.

Student level: ${levelLabel}
Course: ${course}
Topic: ${topic}

Requirements:
- Use your own knowledge of the topic (no external sources).
- Include a concise overview and total time estimate (hours).
- Break the learning path into 3-5 modules.
- Each module should include 2-4 steps with explanations and 6-8 sample questions per step.
- If level is "Starting from zero", start with core concepts and prerequisites.
- Include guided practice, short-answer drills, and exam-ready questions near the end.
- Render all math using LaTeX wrapped in $...$ (inline) or $$...$$ (block).

Return JSON only with this exact shape:
{
  "title": "<topic title>",
  "overview": "<2-4 sentence overview>",
  "totalHours": <number>,
  "modules": [
    {
      "id": "1",
      "title": "<module title>",
      "summary": "<1-2 sentence summary>",
      "steps": [
        {
          "id": "1.1",
          "title": "<short step title>",
          "content": [
            { "title": "<short title>", "body": "<2-4 sentences>" }
          ],
          "questions": [
            {
              "prompt": "<question>",
              "options": ["A", "B", "C", "D"],
              "correctIndex": 0
            }
          ]
        }
      ]
    }
  ]
}
`;
}

export async function POST(request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing GEMINI_API_KEY" },
      { status: 500 }
    );
  }

  try {
    const payload = await request.json();
    const cacheKey = JSON.stringify({
      course: payload.course,
      level: payload.level,
      topic: payload.topic
    });
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.at < RESPONSE_CACHE_TTL_MS) {
      return NextResponse.json(cached.value);
    }
    const modelName = await getModelName(apiKey);
    const result = await generateContent(
      apiKey,
      modelName,
      buildPrompt(payload)
    );
    const text =
      result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      return NextResponse.json(
        { error: "Invalid AI response." },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    const responseBody = {
      title: parsed.title || payload.topic,
      overview: parsed.overview || "",
      totalHours: Number(parsed.totalHours) || null,
      modules: Array.isArray(parsed.modules) ? parsed.modules : []
    };
    responseCache.set(cacheKey, { at: Date.now(), value: responseBody });
    return NextResponse.json(responseBody);
  } catch (error) {
    console.error("AI learning plan failed:", error);
    return NextResponse.json(
      { error: error?.message || "Learning plan failed." },
      { status: 500 }
    );
  }
}
