import { NextResponse } from "next/server";

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const MAX_CHARS_PER_CHUNK = 3500;

function stripLatexForTts(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/\$\$[\s\S]+?\$\$/g, " ")
    .replace(/\$[^$]+\$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function chunkText(text, maxLen = MAX_CHARS_PER_CHUNK) {
  const cleaned = stripLatexForTts(text);
  if (!cleaned.length) return [];
  if (cleaned.length <= maxLen) return [cleaned];

  const chunks = [];
  let rest = cleaned;

  while (rest.length > 0) {
    if (rest.length <= maxLen) {
      chunks.push(rest.trim());
      break;
    }
    const slice = rest.slice(0, maxLen);
    const lastPeriod = slice.lastIndexOf(".");
    const lastNewline = slice.lastIndexOf("\n");
    const breakAt = Math.max(lastPeriod, lastNewline, Math.floor(maxLen * 0.8));
    const chunk = (breakAt > 0 ? slice.slice(0, breakAt + 1) : slice).trim();
    chunks.push(chunk);
    rest = rest.slice(chunk.length).trim();
  }

  return chunks.filter(Boolean);
}

async function generateChunk(apiKey, voiceId, text, previousText, nextText) {
  const url = `${ELEVENLABS_BASE}/text-to-speech/${voiceId}`;
  const body = {
    text,
    model_id: "eleven_multilingual_v2",
    ...(previousText && { previous_text: previousText.slice(-500) }),
    ...(nextText && { next_text: nextText.slice(0, 500) })
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs TTS failed: ${res.status} ${errText}`);
  }

  const buffer = await res.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}

export async function POST(request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing ELEVENLABS_API_KEY" },
      { status: 500 }
    );
  }

  try {
    const { text, voiceId = DEFAULT_VOICE_ID } = await request.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Request body must include a non-empty 'text' string." },
        { status: 400 }
      );
    }

    const chunks = chunkText(text);
    if (chunks.length === 0) {
      return NextResponse.json({ chunks: [] });
    }

    const audioChunks = [];
    for (let i = 0; i < chunks.length; i++) {
      const previousText = i > 0 ? chunks[i - 1] : "";
      const nextText = i < chunks.length - 1 ? chunks[i + 1] : "";
      const b64 = await generateChunk(
        apiKey,
        voiceId,
        chunks[i],
        previousText,
        nextText
      );
      audioChunks.push(b64);
    }

    return NextResponse.json({ chunks: audioChunks });
  } catch (error) {
    console.error("TTS error:", error);
    return NextResponse.json(
      { error: error?.message || "Text-to-speech failed." },
      { status: 500 }
    );
  }
}
