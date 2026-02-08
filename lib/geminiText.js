// Prefer v1beta; it supports newer generation config fields.
const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

function makeError(message, status) {
  const err = new Error(message);
  if (status != null) err.status = status;
  return err;
}

const PREFERRED_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-1.0-pro"
];

function normalizeModelName(name) {
  if (!name) return "";
  return String(name).startsWith("models/")
    ? String(name).slice("models/".length)
    : String(name);
}

async function listModels(apiKey) {
  const response = await fetch(`${API_BASE_URL}/models?key=${apiKey}`);
  if (!response.ok) {
    let errorMessage = `List models failed: ${response.status}`;
    try {
      const body = await response.json();
      if (body?.error?.message) errorMessage = body.error.message;
    } catch {
      // ignore
    }
    throw makeError(errorMessage, response.status);
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
    const availableNames = available.map((m) => normalizeModelName(m.name));
    for (const preferred of PREFERRED_MODELS) {
      if (availableNames.includes(preferred)) return preferred;
    }
    return availableNames[0] || PREFERRED_MODELS[0];
  } catch {
    return PREFERRED_MODELS[0];
  }
}

function isModelNotFoundOrUnsupported(message, status) {
  const msg = String(message || "");
  if (status === 404) return true;
  return /not found|not supported for generateContent|supported methods/i.test(
    msg
  );
}

async function generateOnce(apiKey, model, prompt, options = {}) {
  const generationConfig = {};
  if (typeof options.temperature === "number") {
    generationConfig.temperature = options.temperature;
  }
  if (options.responseMimeType) {
    generationConfig.responseMimeType = String(options.responseMimeType);
  }

  const response = await fetch(
    `${API_BASE_URL}/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: String(prompt || "") }] }],
        ...(Object.keys(generationConfig).length ? { generationConfig } : null)
      })
    }
  );

  if (!response.ok) {
    let errorMessage = `Gemini request failed: ${response.status}`;
    try {
      const body = await response.json();
      if (body?.error?.message) errorMessage = body.error.message;
    } catch {
      // ignore
    }
    throw makeError(errorMessage, response.status);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

export async function generateGeminiText(prompt, options = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw makeError("Missing GEMINI_API_KEY", 500);

  const requestedModel = options.model;
  const initialModel = requestedModel || (await pickModelName(apiKey));

  try {
    return await generateOnce(apiKey, initialModel, prompt, options);
  } catch (err) {
    // Some API versions/models reject responseMimeType; retry without it.
    if (
      options.responseMimeType &&
      err?.status === 400 &&
      /Unknown name "responseMimeType"/i.test(String(err?.message || ""))
    ) {
      const { responseMimeType, ...rest } = options;
      return await generateGeminiText(prompt, rest);
    }

    if (!isModelNotFoundOrUnsupported(err?.message, err?.status)) throw err;
    const fallbackModel = await pickModelName(apiKey);
    if (!fallbackModel || fallbackModel === initialModel) throw err;
    try {
      return await generateOnce(apiKey, fallbackModel, prompt, options);
    } catch (fallbackErr) {
      if (
        options.responseMimeType &&
        fallbackErr?.status === 400 &&
        /Unknown name "responseMimeType"/i.test(String(fallbackErr?.message || ""))
      ) {
        const { responseMimeType, ...rest } = options;
        return await generateOnce(apiKey, fallbackModel, prompt, rest);
      }
      throw fallbackErr;
    }
  }
}

