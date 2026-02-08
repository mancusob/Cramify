"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

function safeJsonParse(value) {
  try {
    return JSON.parse(String(value || ""));
  } catch {
    return null;
  }
}

export default function ExamPracticePage() {
  const [plan] = useState(() => {
    if (typeof window === "undefined") return null;
    const rawPlan = sessionStorage.getItem("cramifyAiPlan");
    const parsedPlan = rawPlan ? safeJsonParse(rawPlan) : null;
    return parsedPlan && typeof parsedPlan === "object" ? parsedPlan : null;
  });
  const [examBank] = useState(() => {
    if (typeof window === "undefined") return null;
    const rawBank = sessionStorage.getItem("cramifyExamBank");
    const parsedBank = rawBank ? safeJsonParse(rawBank) : null;
    return parsedBank &&
      typeof parsedBank === "object" &&
      Array.isArray(parsedBank.items)
      ? parsedBank
      : null;
  });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [emphasis, setEmphasis] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [choiceState, setChoiceState] = useState({});
  const [showAnswers, setShowAnswers] = useState({});

  const examples = useMemo(() => {
    if (!examBank?.items?.length) return [];
    return examBank.items.slice(0, 20).map((it) => ({
      question: it?.question,
      answer: it?.answer
    }));
  }, [examBank]);

  const generate = useCallback(async () => {
    if (!examples.length) return;
    setStatus("loading");
    setError("");
    setEmphasis([]);
    setQuestions([]);
    setChoiceState({});
    setShowAnswers({});
    try {
      const response = await fetch("/api/exam/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course: plan?.course || examBank?.course || "Your course",
          level: plan?.level || examBank?.level || "0",
          topic: "Exam practice",
          examples,
          focusCount: 8,
          count: 10
        })
      });

      if (!response.ok) {
        const responseClone = response.clone();
        let errorMessage = "Practice question generation failed.";
        try {
          const errorBody = await response.json();
          if (errorBody?.error) errorMessage = errorBody.error;
        } catch {
          const errorText = await responseClone.text();
          if (errorText) errorMessage = errorText;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      setEmphasis(Array.isArray(result.emphasizedTopics) ? result.emphasizedTopics : []);
      setQuestions(Array.isArray(result.questions) ? result.questions : []);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err?.message || "Practice question generation failed.");
    }
  }, [examples, plan, examBank]);

  useEffect(() => {
    if (!examBank?.items?.length) return;
    if (status !== "idle") return;
    generate();
  }, [examBank, status, generate]);

  return (
    <main className="container">
      <header className="header">
        <div>
          <h1>Exam Practice</h1>
          <p className="subtitle">
            New MCQs generated only from your uploaded exam PDFs.
          </p>
        </div>
        <div className="row">
          <button
            type="button"
            className="ghost"
            onClick={generate}
            disabled={!examples.length || status === "loading"}
          >
            {status === "loading" ? "Generating..." : "Regenerate"}
          </button>
          <Link className="ghost" href="/roadmap">
            Back
          </Link>
        </div>
      </header>

      {!examBank?.items?.length ? (
        <section className="panel">
          <h2>No exam bank found</h2>
          <p className="muted">
            Go back to Step 3 and upload your exam questions + solutions PDFs to
            build the exam bank first.
          </p>
          <Link className="primary" href="/">
            Go to setup
          </Link>
        </section>
      ) : (
        <section className="panel stack">
          {status === "error" && <p className="muted">{error}</p>}
          {status === "loading" && <p className="muted">Generating questions…</p>}

          {emphasis.length > 0 && (
            <p className="muted">
              <strong>Emphasized on your exam:</strong> {emphasis.slice(0, 10).join(", ")}
            </p>
          )}

          {status === "ready" && questions.length > 0 && (
            <div className="roadmap-grid">
              {questions.map((q, idx) => {
                const id = String(q?.id || `exam-${idx + 1}`);
                const state = choiceState[id] || {
                  selectedIndex: null,
                  status: "idle"
                };
                const choices = Array.isArray(q?.choices) ? q.choices : [];
                const correctIdx =
                  typeof q?.correctChoiceIndex === "number" ? q.correctChoiceIndex : -1;
                const show = Boolean(showAnswers[id]);
                const locked = state.status === "correct";

                return (
                  <div key={id} className="plan-card">
                    <span className="tag">Question {idx + 1}</span>
                    {q?.difficulty && (
                      <p className="muted" style={{ marginTop: "0.35rem" }}>
                        Difficulty: {String(q.difficulty)}
                      </p>
                    )}
                    <p style={{ marginTop: "0.5rem" }}>{String(q?.question || "")}</p>

                    {choices.length === 4 && correctIdx >= 0 && correctIdx <= 3 && (
                      <div className="stack" style={{ marginTop: "0.75rem" }}>
                        {choices.map((choice, cIdx) => {
                          const isCorrect = cIdx === correctIdx;
                          const buttonClass =
                            locked && isCorrect ? "primary" : "ghost";
                          return (
                            <button
                              key={`${id}-choice-${cIdx}`}
                              type="button"
                              className={`${buttonClass} mcq-choice`}
                              disabled={locked}
                              onClick={() => {
                                const nextStatus =
                                  cIdx === correctIdx ? "correct" : "incorrect";
                                setChoiceState((prev) => ({
                                  ...prev,
                                  [id]: { selectedIndex: cIdx, status: nextStatus }
                                }));
                              }}
                              style={{
                                textAlign: "left",
                                opacity: locked && !isCorrect ? 0.7 : 1
                              }}
                            >
                              {String.fromCharCode(65 + cIdx)}. {String(choice || "")}
                              {state.selectedIndex === cIdx &&
                                state.status === "incorrect" &&
                                " (try again)"}
                              {locked && isCorrect && " (correct)"}
                            </button>
                          );
                        })}
                        {state.status === "incorrect" && (
                          <p className="muted">Incorrect — try again.</p>
                        )}
                        {state.status === "correct" && <p className="muted">Correct.</p>}
                      </div>
                    )}

                    <div className="row" style={{ marginTop: "0.75rem" }}>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() =>
                          setShowAnswers((prev) => ({
                            ...prev,
                            [id]: !prev[id]
                          }))
                        }
                      >
                        {show ? "Hide answer" : "Show answer"}
                      </button>
                    </div>
                    {show && (
                      <p className="muted" style={{ marginTop: "0.5rem" }}>
                        <strong>Answer:</strong> {String(q?.answer || "")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {status === "ready" && questions.length === 0 && (
            <p className="muted">No questions returned. Try “Regenerate”.</p>
          )}
        </section>
      )}
    </main>
  );
}

