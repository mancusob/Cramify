import { NextResponse } from "next/server";
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

function stripChoicePrefix(choice) {
  // Remove leading "A.", "B)", "1)", "-" etc.
  return String(choice || "")
    .replace(/^\s*([A-Da-d]|\d)\s*[\)\.\:]\s*/g, "")
    .replace(/^\s*-\s*/g, "")
    .trim();
}

function normalizeChoices(rawChoices) {
  const arr = Array.isArray(rawChoices) ? rawChoices : [];
  const cleaned = arr
    .map((c) => stripChoicePrefix(c))
    .filter(Boolean);
  return cleaned.slice(0, 4);
}

function normalizeCorrectChoiceIndex(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const s = String(value ?? "").trim();
  if (!s) return null;
  const upper = s.toUpperCase();
  if (["A", "B", "C", "D"].includes(upper)) return upper.charCodeAt(0) - 65;
  const asNum = Number(s);
  if (Number.isFinite(asNum)) {
    // Accept 1-4 or 0-3.
    if (asNum >= 0 && asNum <= 3) return asNum;
    if (asNum >= 1 && asNum <= 4) return asNum - 1;
  }
  return null;
}

function parseChoicesFromQuestionText(text) {
  const raw = String(text || "");
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const extracted = [];
  for (const line of lines) {
    const m = line.match(/^([A-Da-d])\s*[\)\.\:]\s*(.+)$/);
    if (m) extracted.push(stripChoicePrefix(m[0]));
  }
  return extracted.slice(0, 4);
}

async function repairMcq({
  model,
  course,
  level,
  topic,
  question,
  solutionCpp,
  reasoning
}) {
  const prompt = `
You are repairing a multiple-choice question JSON.

You will be given:
- a question prompt
- an (optional) C++ solution and reasoning

Your job:
- produce EXACTLY 4 answer choices
- exactly ONE choice must be correct
- return correctChoiceIndex as an INTEGER 0..3
- choices must be short, plausible distractors

Return JSON only:
{
  "choices": ["...", "...", "...", "..."],
  "correctChoiceIndex": 0
}

Context:
Course: ${course}
Level: ${level}
Topic page: ${topic}

Question:
<<<
${String(question || "")}
>>>

Solution (C++), if provided:
<<<
${String(solutionCpp || "")}
>>>

Reasoning, if provided:
<<<
${String(reasoning || "")}
>>>
`;

  const text = await generateGeminiText(prompt, {
    model,
    temperature: 0.2,
    responseMimeType: "application/json"
  });
  const parsed = safeJsonParse(text);
  return {
    choices: normalizeChoices(parsed?.choices),
    correctChoiceIndex: normalizeCorrectChoiceIndex(parsed?.correctChoiceIndex)
  };
}

function buildGeneratePrompt({
  course,
  level,
  topic,
  examples,
  count,
  focusCount
}) {
  const exampleLines = (Array.isArray(examples) ? examples : [])
    .slice(0, 20)
    .map((ex, idx) => {
      const q = String(ex?.question || "").trim();
      const a = String(ex?.answer || "").trim();
      return `Example ${idx + 1}:\nQ: ${q}\nA: ${a}`;
    })
    .join("\n\n");

  return `
You are an exam-preparation question designer.

You will be given practice exams with solutions, but you MUST NOT:
- copy question structure
- reuse function names
- reuse the same task framing
- ask for the same operation in disguise

Your goal is to generate new practice questions that test the SAME UNDERLYING CONCEPTS,
but through different problem formulations that require conceptual transfer rather than memorization.

Step 1 — Concept Extraction (internal)
From the practice exam, internally identify:
- core data structure or algorithmic concept being tested
- typical mistakes students make on that concept
- the skill being evaluated (e.g., pointer manipulation, asymptotic reasoning, traversal optimization)

Step 2 — Novel Question Design
For each extracted concept, generate 1–2 new questions that:
- introduce a new real-world or abstract framing
- add at least one new constraint (e.g., single traversal, limited memory, reverse traversal, early stopping)
- cannot be solved by minor edits to the original exam solution
The questions must feel unfamiliar even to someone who memorized the exam.

Step 3 — Difficulty Calibration
For each question:
- clearly label difficulty (Easy / Medium / Hard)
- explain in 1 sentence why it is testing the same concept

Step 4 — Answer Generation
For each question:
- provide a complete and correct solution in C++
- briefly explain the reasoning, not just the final code

Hard Constraint (VERY IMPORTANT)
If a generated question could be reasonably accused of being a modified version of an exam question, discard it and regenerate.

Validation (MANDATORY):
- Each question MUST include "choices" as an array of EXACTLY 4 strings.
- "correctChoiceIndex" MUST be an integer 0,1,2,or 3.
- If your draft fails validation, fix it before responding.

Return JSON only with this exact shape:
{
  "emphasizedTopics": ["<concept/skill>", "..."],
  "questions": [
    {
      "id": "1",
      "topic": "<one of emphasizedTopics>",
      "difficulty": "Easy",
      "conceptTested": "<concept/skill being tested>",
      "question": "<new multiple-choice question prompt>",
      "choices": ["A", "B", "C", "D"],
      "correctChoiceIndex": 0,
      "solutionCpp": "<complete C++ solution (if applicable, otherwise empty string)>",
      "reasoning": "<brief explanation of reasoning>",
      "sameConceptWhy": "<1 sentence why it tests the same concept>"
    }
  ]
}

Context:
Course: ${course}
Student level: ${level}
Requested topic page: ${topic}
Generate exactly ${focusCount} emphasizedTopics and exactly ${count} questions.

Practice exam examples (questions + solutions):
${exampleLines || "(none provided)"}
`;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const course = String(body.course || "Your course");
    const level = String(body.level || "0");
    const topic = String(body.topic || "").trim();
    const examples = Array.isArray(body.examples) ? body.examples : [];
    const countRaw = Number(body.count || 5);
    const count = Number.isFinite(countRaw)
      ? Math.min(Math.max(Math.floor(countRaw), 1), 10)
      : 5;
    const focusRaw = Number(body.focusCount || 5);
    const focusCount = Number.isFinite(focusRaw)
      ? Math.min(Math.max(Math.floor(focusRaw), 3), 10)
      : 5;

    if (!topic) {
      return NextResponse.json({ error: "Missing topic." }, { status: 400 });
    }
    if (!examples.length) {
      return NextResponse.json(
        { error: "Missing exam examples." },
        { status: 400 }
      );
    }

    const prompt = buildGeneratePrompt({
      course,
      level,
      topic,
      examples,
      count,
      focusCount
    });
    const model = process.env.GEMINI_EXAM_GENERATE_MODEL || "gemini-1.5-flash";
    const text = await generateGeminiText(prompt, {
      model,
      temperature: 0.3,
      responseMimeType: "application/json"
    });
    const parsed = safeJsonParse(text);
    const emphasizedTopics = Array.isArray(parsed.emphasizedTopics)
      ? parsed.emphasizedTopics
      : [];
    const questionsRaw = Array.isArray(parsed.questions) ? parsed.questions : [];
    const questions = [];

    for (let idx = 0; idx < questionsRaw.length; idx += 1) {
      const q = questionsRaw[idx];
      const id = String(q?.id || idx + 1);
      const topicTag = String(q?.topic || "").trim();
      const difficulty = String(q?.difficulty || "").trim();
      const conceptTested = String(q?.conceptTested || "").trim();
      const sameConceptWhy = String(q?.sameConceptWhy || "").trim();
      const questionBody = String(q?.question || q?.problemStatement || "").trim();
      const solutionCpp = String(q?.solutionCpp || q?.solution || "").trim();
      const reasoning = String(q?.reasoning || "").trim();

      let choices = normalizeChoices(q?.choices);
      if (choices.length !== 4) {
        const parsedFromText = parseChoicesFromQuestionText(questionBody);
        if (parsedFromText.length === 4) choices = parsedFromText;
      }

      let correctChoiceIndex = normalizeCorrectChoiceIndex(q?.correctChoiceIndex);

      // If still malformed, do a targeted one-question repair call.
      if (choices.length !== 4 || correctChoiceIndex == null || correctChoiceIndex < 0 || correctChoiceIndex > 3) {
        const repaired = await repairMcq({
          model,
          course,
          level,
          topic,
          question: questionBody,
          solutionCpp,
          reasoning
        });
        if (repaired.choices.length === 4) choices = repaired.choices;
        if (repaired.correctChoiceIndex != null) {
          correctChoiceIndex = repaired.correctChoiceIndex;
        }
      }

      // Final guard: ensure we don't break the UI contract.
      if (choices.length !== 4) {
        // Pad with generic distractors (rare fallback).
        while (choices.length < 4) choices.push("None of the above");
        choices = choices.slice(0, 4);
      }
      if (correctChoiceIndex == null || correctChoiceIndex < 0 || correctChoiceIndex > 3) {
        correctChoiceIndex = 0;
      }

      const questionText = [
        difficulty ? `Difficulty: ${difficulty}` : "",
        conceptTested ? `Concept tested: ${conceptTested}` : "",
        questionBody
      ]
        .filter(Boolean)
        .join("\n\n")
        .trim();

      const answerText = [
        choices[correctChoiceIndex] ? `Correct choice: ${choices[correctChoiceIndex]}` : "",
        solutionCpp ? `Solution (C++):\n${solutionCpp}` : "",
        reasoning ? `\nReasoning:\n${reasoning}` : "",
        sameConceptWhy ? `\nWhy same concept:\n${sameConceptWhy}` : ""
      ]
        .filter(Boolean)
        .join("\n")
        .trim();

      questions.push({
        id,
        topic: topicTag,
        difficulty,
        conceptTested,
        sameConceptWhy,
        choices,
        correctChoiceIndex,
        solutionCpp,
        reasoning,
        // Backward-compatible fields used by the UI.
        question: questionText,
        answer: answerText
      });
    }

    return NextResponse.json({ emphasizedTopics, questions });
  } catch (error) {
    console.error("Exam question generation failed:", error);
    return NextResponse.json(
      { error: error?.message || "Exam question generation failed." },
      { status: 500 }
    );
  }
}

