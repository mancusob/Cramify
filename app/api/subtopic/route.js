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

function buildPrompt({ course, level, topic, stepTitle, stepDescription }) {
  const levelLabel = LEVEL_LABELS[level] || LEVEL_LABELS[0];
  return `
You are an expert tutor. Teach the user this specific learning step, then provide sample questions with answers.

Course: ${course}
Student level: ${levelLabel}
Topic: ${topic}
Learning step: ${stepTitle}
Step description: ${stepDescription}

Requirements:
- Explain the concept clearly for the given student level.
- Provide 2-4 short explanation blocks with titles.
- Then provide 3-5 sample questions with short answers.
- Keep it concise and exam-focused.

Return JSON only with this exact shape:
{
  "explanations": [
    { "title": "<short title>", "body": "<2-4 sentences>" }
  ],
  "questions": [
    { "prompt": "<question>", "answer": "<short answer>" }
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
      topic: payload.topic,
      stepTitle: payload.stepTitle,
      stepDescription: payload.stepDescription
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
      explanations: parsed.explanations || [],
      questions: parsed.questions || []
    };
    responseCache.set(cacheKey, { at: Date.now(), value: responseBody });
    return NextResponse.json(responseBody);
  } catch (error) {
    console.error("AI subtopic lesson failed:", error);
    return NextResponse.json(
      { error: error?.message || "Subtopic fetch failed." },
      { status: 500 }
    );
  }
}
