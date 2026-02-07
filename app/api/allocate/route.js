import { NextResponse } from "next/server";

export const runtime = "nodejs";

const API_BASE_URL = "https://generativelanguage.googleapis.com/v1";
const PREFERRED_MODELS = [
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-1.0-pro"
];

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

function buildPrompt(payload) {
  return `
You are an expert exam strategist. Allocate study hours across topics to maximize expected grade improvement.
Constraints:
- Total allocated hours must equal ${payload.hoursAvailable} hours (within +/- 0.1).
- Be realistic: allocate at least 0.5 hours per topic if any time is allocated.
- Base the allocation on domain knowledge: prerequisite chains, baseline understanding needs, and relative difficulty.
- Avoid giving identical allocations unless topics are truly comparable in difficulty and prerequisite importance.
- Reasons must explicitly mention the inferred difficulty or prerequisite role.

Return JSON only with this exact shape:
{
  "allocations": {
    "<topic name>": {
      "hours": <hours number>,
      "reason": "<short explanation, 1 sentence>"
    }
  }
}

Data:
Course: ${payload.course}
Level: ${payload.level}
Hours until exam: ${payload.hoursUntil}
Topics:
${payload.topics.map((topic) => `- ${topic.name}`).join("\n")}
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
    const modelName = await pickModelName(apiKey);
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
    return NextResponse.json({ allocations: parsed.allocations || {} });
  } catch (error) {
    console.error("AI allocation failed:", error);
    return NextResponse.json(
      { error: error?.message || "Allocation failed." },
      { status: 500 }
    );
  }
}
