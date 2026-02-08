import { NextResponse } from "next/server";
import { extractTextFromPdfArrayBuffer, clampText } from "../../../../lib/pdf";
import { generateGeminiText } from "../../../../lib/geminiText";

export const runtime = "nodejs";

function safeJsonParse(text) {
  const raw = String(text || "");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Invalid AI response.");
  }
  return JSON.parse(raw.slice(start, end + 1));
}

function buildIngestPrompt({
  course,
  level,
  topics,
  questionsText,
  answersText
}) {
  const topicList = Array.isArray(topics) ? topics.filter(Boolean) : [];
  const topicLines = topicList.map((t) => `- ${t}`).join("\n");

  return `
You are helping build a study app from exam PDFs.

Goal:
- Convert the exam questions PDF + exam answers/solutions PDF into a structured JSON question bank.

Rules:
- Use ONLY the information in the PDFs below.
- If a solution is not found, still include the question but leave "answer" as an empty string.
- If you cannot perfectly match every question to its exact solution, do your best using question numbers, wording, and section headers.
- Assign each item to exactly ONE topic from the allowed topic list.
- If none fit well, choose the closest.

Return JSON only with this exact shape:
{
  "items": [
    {
      "id": "Q1",
      "topic": "<must be one of the allowed topics>",
      "question": "<question text>",
      "answer": "<answer/solution text (can be empty)>"
    }
  ]
}

Context:
Course: ${course}
Student level: ${level}
Allowed topics:
${topicLines || "- (no topics provided)"}

Exam Questions PDF (text):
<<<
${questionsText}
>>>

Exam Answers/Solutions PDF (text):
<<<
${answersText}
>>>
`;
}

export async function POST(request) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let course = "Your course";
    let level = "0";
    let topics = [];
    let questionsText = "";
    let answersText = "";

    if (contentType.includes("application/json")) {
      const body = await request.json();
      course = String(body.course || "Your course");
      level = String(body.level || "0");
      topics = Array.isArray(body.topics)
        ? body.topics.map((t) => String(t).trim()).filter(Boolean)
        : String(body.topics || "")
            .split(/[\n,]+/g)
            .map((t) => t.trim())
            .filter(Boolean);
      questionsText = clampText(String(body.questionsText || ""), 80_000);
      answersText = clampText(String(body.answersText || ""), 80_000);
    } else {
      // Fallback: multipart upload (server-side PDF parsing).
      const formData = await request.formData();
      const questionsPdf = formData.get("questionsPdf");
      const answersPdf = formData.get("answersPdf");
      course = String(formData.get("course") || "Your course");
      level = String(formData.get("level") || "0");
      const topicsRaw = String(formData.get("topics") || "");
      topics = topicsRaw
        .split(/[\n,]+/g)
        .map((t) => t.trim())
        .filter(Boolean);

      if (!questionsPdf || typeof questionsPdf.arrayBuffer !== "function") {
        return NextResponse.json(
          { error: "Missing questionsPdf file." },
          { status: 400 }
        );
      }
      if (!answersPdf || typeof answersPdf.arrayBuffer !== "function") {
        return NextResponse.json(
          { error: "Missing answersPdf file." },
          { status: 400 }
        );
      }

      const [questionsBuf, answersBuf] = await Promise.all([
        questionsPdf.arrayBuffer(),
        answersPdf.arrayBuffer()
      ]);

      const [questionsTextRaw, answersTextRaw] = await Promise.all([
        extractTextFromPdfArrayBuffer(questionsBuf),
        extractTextFromPdfArrayBuffer(answersBuf)
      ]);

      questionsText = clampText(questionsTextRaw, 80_000);
      answersText = clampText(answersTextRaw, 80_000);
    }

    const prompt = buildIngestPrompt({
      course,
      level,
      topics,
      questionsText,
      answersText
    });

    const model = process.env.GEMINI_EXAM_INGEST_MODEL || "gemini-1.5-flash";
    const text = await generateGeminiText(prompt, {
      model,
      temperature: 0.2,
      responseMimeType: "application/json"
    });
    const parsed = safeJsonParse(text);
    const items = Array.isArray(parsed.items) ? parsed.items : [];

    return NextResponse.json({
      bank: {
        course,
        level,
        topics,
        createdAt: new Date().toISOString(),
        items
      }
    });
  } catch (error) {
    console.error("Exam ingest failed:", error);
    return NextResponse.json(
      { error: error?.message || "Exam ingest failed." },
      { status: 500 }
    );
  }
}

