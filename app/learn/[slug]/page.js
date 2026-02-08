"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export default function TopicLearn() {
  const params = useParams();
  const [plan, setPlan] = useState(null);
  const [steps, setSteps] = useState([]);
  const [stepStatus, setStepStatus] = useState({});
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [examBank, setExamBank] = useState(null);
  const [examGenStatus, setExamGenStatus] = useState("idle");
  const [examGenError, setExamGenError] = useState("");
  const [examQuestions, setExamQuestions] = useState([]);
  const [examShowAnswers, setExamShowAnswers] = useState({});
  const [generatedStatus, setGeneratedStatus] = useState("idle");
  const [generatedError, setGeneratedError] = useState("");
  const [generatedEmphasis, setGeneratedEmphasis] = useState([]);
  const [generatedQuestions, setGeneratedQuestions] = useState([]);
  const [generatedShowAnswers, setGeneratedShowAnswers] = useState({});
  const [generatedChoiceState, setGeneratedChoiceState] = useState({});

  useEffect(() => {
    const raw = sessionStorage.getItem("cramifyAiPlan");
    if (raw) {
      try {
        setPlan(JSON.parse(raw));
      } catch (error) {
        setPlan(null);
      }
    }
  }, []);

  useEffect(() => {
    const raw = sessionStorage.getItem("cramifyExamBank");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.items)) {
        setExamBank(parsed);
      }
    } catch {
      setExamBank(null);
    }
  }, []);

  useEffect(() => {
    const slug = params?.slug;
    if (!plan?.topics?.length || !slug) return;
    const stepsRaw = sessionStorage.getItem(`cramifyTopicSteps:${slug}`);
    const statusRaw = sessionStorage.getItem(`cramifyTopicStepStatus:${slug}`);
    const progressRaw = sessionStorage.getItem(`cramifyTopicProgress:${slug}`);
    if (stepsRaw) {
      try {
        const parsed = JSON.parse(stepsRaw);
        setSteps(Array.isArray(parsed) ? parsed : []);
      } catch {
        setSteps([]);
      }
    }
    if (statusRaw) {
      try {
        const parsed = JSON.parse(statusRaw);
        setStepStatus(parsed && typeof parsed === "object" ? parsed : {});
      } catch {
        setStepStatus({});
      }
    } else if (progressRaw) {
      try {
        const parsed = JSON.parse(progressRaw);
        if (Array.isArray(parsed)) {
          const nextStatus = parsed.reduce((acc, id) => {
            acc[id] = "done";
            return acc;
          }, {});
          setStepStatus(nextStatus);
        } else {
          setStepStatus({});
        }
      } catch {
        setStepStatus({});
      }
    }
  }, [plan, params]);

  useEffect(() => {
    const slug = params?.slug;
    if (!plan?.topics?.length || !slug) return;
    if (steps.length) return;
    const match = plan.topics.find((name) => slugify(name) === slug);
    if (!match) return;
    const loadSteps = async () => {
      setStatus("loading");
      setError("");
      try {
        const response = await fetch("/api/learn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            course: plan.course,
            level: plan.level,
            topic: match
          })
        });
        if (!response.ok) {
          const responseClone = response.clone();
          let errorMessage = "Learning plan failed.";
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
        const nextSteps = Array.isArray(result.steps) ? result.steps : [];
        setSteps(nextSteps);
        sessionStorage.setItem(
          `cramifyTopicSteps:${slug}`,
          JSON.stringify(nextSteps)
        );
        setStatus("ready");
      } catch (error) {
        setStatus("error");
        setError(error?.message || "Learning plan failed.");
      }
    };
    loadSteps();
  }, [plan, params, steps.length]);

  useEffect(() => {
    const slug = params?.slug;
    if (!slug) return;
    sessionStorage.setItem(
      `cramifyTopicStepStatus:${slug}`,
      JSON.stringify(stepStatus)
    );
  }, [stepStatus, params]);

  const topic = useMemo(() => {
    const slug = params?.slug;
    if (!plan?.topics?.length || !slug) return null;
    const allocations = plan.allocations || {};
    const match = plan.topics.find((name) => slugify(name) === slug);
    if (!match) return null;
    const entry = allocations[match];
    const hours =
      typeof entry === "number"
        ? entry
        : typeof entry?.hours === "number"
          ? entry.hours
          : null;
    const reason = typeof entry?.reason === "string" ? entry.reason : "";
    return { name: match, hours, reason };
  }, [plan, params]);

  const stepsWithIds = useMemo(
    () =>
      steps.map((step, index) => ({
        id: step.id || `${index + 1}`,
        title: step.title || `Step ${index + 1}`,
        description: step.description || "",
        stage: step.stage || "practice"
      })),
    [steps]
  );

  const progressRatio =
    stepsWithIds.length > 0
      ? Object.keys(stepStatus).length / stepsWithIds.length
      : 0;
  const remainingHours =
    topic?.hours != null
      ? Math.max(topic.hours * (1 - progressRatio), 0)
      : null;

  const examExamplesForTopic = useMemo(() => {
    if (!examBank?.items?.length || !topic?.name) return [];
    const name = topic.name.toLowerCase();
    const matched = examBank.items.filter(
      (it) => String(it?.topic || "").toLowerCase() === name
    );
    return matched;
  }, [examBank, topic]);

  const generateNewPracticeQuestions = async () => {
    if (!plan || !topic || !examBank?.items?.length) return;
    setGeneratedStatus("loading");
    setGeneratedError("");
    setGeneratedEmphasis([]);
    setGeneratedQuestions([]);
    setGeneratedShowAnswers({});
    setGeneratedChoiceState({});
    try {
      const sourceItems =
        examExamplesForTopic.length > 0 ? examExamplesForTopic : examBank.items;
      const examples = sourceItems.slice(0, 20).map((it) => ({
        question: it.question,
        answer: it.answer
      }));
      if (!examples.length) {
        throw new Error("No exam questions found in your PDFs.");
      }

      const response = await fetch("/api/exam/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course: plan.course,
          level: plan.level,
          topic: topic.name,
          examples,
          focusCount: 5,
          count: 5
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
      const emphasizedTopics = Array.isArray(result.emphasizedTopics)
        ? result.emphasizedTopics
        : [];
      const qs = Array.isArray(result.questions) ? result.questions : [];
      setGeneratedEmphasis(emphasizedTopics);
      setGeneratedQuestions(qs);
      setGeneratedStatus("ready");
    } catch (err) {
      setGeneratedStatus("error");
      setGeneratedError(err?.message || "Practice question generation failed.");
    }
  };

  const startExamLearning = async () => {
    if (!topic || !examBank?.items?.length) return;
    setExamGenStatus("loading");
    setExamGenError("");
    setExamQuestions([]);
    setExamShowAnswers({});
    try {
      const picked = examExamplesForTopic.slice(0, 12);
      if (!picked.length) {
        throw new Error("No exam questions found for this topic in your PDFs.");
      }
      setExamQuestions(
        picked.map((it, idx) => ({
          id: String(it?.id || idx + 1),
          question: String(it?.question || ""),
          answer: String(it?.answer || "")
        }))
      );
      setExamGenStatus("ready");
    } catch (err) {
      setExamGenStatus("error");
      setExamGenError(err?.message || "Failed to load exam questions.");
    }
  };

  return (
    <main className="container">
      <header className="header">
        <div>
          <h1>{topic ? topic.name : "Topic"}</h1>
          <p className="subtitle">Focused learning path for this topic.</p>
        </div>
        <Link className="ghost" href="/learn">
          Back
        </Link>
      </header>

      {!plan ? (
        <section className="panel">
          <h2>No AI plan found</h2>
          <p className="muted">
            Generate your time allocation first to unlock learning steps.
          </p>
          <Link className="primary" href="/roadmap">
            Go to roadmap
          </Link>
        </section>
      ) : !topic ? (
        <section className="panel">
          <h2>Topic not found</h2>
          <p className="muted">
            This topic isn’t in your current learning plan.
          </p>
          <Link className="primary" href="/learn">
            Back to learning plan
          </Link>
        </section>
      ) : (
        <section className="panel stack">
          <div className="topic-header">
            <div>
              <span className="tag">Focus topic</span>
              <h2>{topic.name}</h2>
            </div>
            <div className="topic-hours">
              <span className="info-label">Allocated time</span>
              <strong>
                {topic.hours != null ? `${topic.hours.toFixed(1)}h` : "—"}
              </strong>
              {topic.reason && <p className="ai-reason">{topic.reason}</p>}
            </div>
          </div>
          <div className="progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progressRatio * 100}%` }}
              />
            </div>
            <span className="muted">
              {Math.round(progressRatio * 100)}% complete ·{" "}
              {remainingHours != null
                ? `${remainingHours.toFixed(1)}h remaining`
                : "Remaining time pending"}
            </span>
          </div>
          <div className="stack">
            <p className="muted">
              Start by learning the core definitions, then work through a few
              representative problems, and finish with a one-page summary of
              formulas and steps.
            </p>
            {status === "loading" && (
              <p className="muted">Building your step-by-step guide...</p>
            )}
            {status === "error" && (
              <p className="muted">AI unavailable. {error}</p>
            )}
            {status !== "loading" && stepsWithIds.length === 0 && (
              <p className="muted">
                No steps found yet. Try reloading the page.
              </p>
            )}
            {stepsWithIds.length > 0 && (
              <div className="checklist">
                {stepsWithIds.map((step) => (
                  <label key={step.id} className="checklist-item">
                    <input
                      type="checkbox"
                      checked={Boolean(stepStatus[step.id])}
                      onChange={(event) => {
                        setStepStatus((prev) => {
                          const next = { ...prev };
                          if (event.target.checked) {
                            next[step.id] = "done";
                          } else {
                            delete next[step.id];
                          }
                          return next;
                        });
                      }}
                    />
                    <div>
                      <div className="row">
                        <strong>{step.title}</strong>
                        {stepStatus[step.id] === "understood" && (
                          <span className="pill">Already understand</span>
                        )}
                      </div>
                      {step.description && (
                        <p className="muted">{step.description}</p>
                      )}
                      <button
                        type="button"
                        className="ghost tiny"
                        onClick={() =>
                          setStepStatus((prev) => {
                            const next = { ...prev };
                            if (next[step.id] === "understood") {
                              delete next[step.id];
                            } else {
                              next[step.id] = "understood";
                            }
                            return next;
                          })
                        }
                      >
                        Already understand
                      </button>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="stack">
            <h2>Practice (from your exam PDFs)</h2>
            {!examBank?.items?.length ? (
              <p className="muted">
                No exam bank found. Upload your exam questions + solutions PDFs
                in Step 3 to see the exact exam questions here.
              </p>
            ) : (
              <>
                <div className="row">
                  <button
                    type="button"
                    className="primary"
                    onClick={startExamLearning}
                    disabled={examGenStatus === "loading"}
                  >
                    {examGenStatus === "loading"
                      ? "Loading exam questions..."
                      : "Start learning"}
                  </button>
                  {examGenStatus === "error" && (
                    <span className="muted">{examGenError}</span>
                  )}
                  {examGenStatus === "ready" && examQuestions.length > 0 && (
                    <span className="muted">
                      Loaded {examQuestions.length} exam questions.
                    </span>
                  )}
                </div>

                {examQuestions.length > 0 && (
                  <div className="roadmap-grid" style={{ marginTop: "1rem" }}>
                    {examQuestions.map((q, idx) => {
                      const id = String(q?.id || idx + 1);
                      const show = Boolean(examShowAnswers[id]);
                      return (
                        <div key={id} className="plan-card">
                          <span className="tag">Question {idx + 1}</span>
                          <p className="muted" style={{ marginTop: "0.35rem" }}>
                            Pulled directly from your uploaded exam PDFs.
                          </p>
                          <p style={{ marginTop: "0.5rem" }}>
                            {String(q?.question || "")}
                          </p>
                          <div className="row" style={{ marginTop: "0.75rem" }}>
                            <button
                              type="button"
                              className="ghost"
                              onClick={() =>
                                setExamShowAnswers((prev) => ({
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
                              <strong>Answer:</strong>{" "}
                              {String(q?.answer || "")}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="stack" style={{ marginTop: "1rem" }}>
                  <h2>Generate new practice questions (AI)</h2>
                  <p className="muted">
                    Uses only your uploaded exam questions to infer what&apos;s emphasized,
                    then creates new questions testing the same skills. Answers included.
                  </p>
                  <div className="row">
                    <button
                      type="button"
                      className="primary"
                      onClick={generateNewPracticeQuestions}
                      disabled={generatedStatus === "loading"}
                    >
                      {generatedStatus === "loading"
                        ? "Generating practice..."
                        : "Generate new questions"}
                    </button>
                    {generatedStatus === "error" && (
                      <span className="muted">{generatedError}</span>
                    )}
                    {generatedStatus === "ready" && generatedQuestions.length > 0 && (
                      <span className="muted">
                        Generated {generatedQuestions.length} questions.
                      </span>
                    )}
                  </div>

                  {generatedEmphasis.length > 0 && (
                    <p className="muted" style={{ marginTop: "0.5rem" }}>
                      <strong>Emphasized on your exam:</strong>{" "}
                      {generatedEmphasis.slice(0, 8).join(", ")}
                    </p>
                  )}

                  {generatedQuestions.length > 0 && (
                    <div className="roadmap-grid" style={{ marginTop: "1rem" }}>
                      {generatedQuestions.map((q, idx) => {
                        const id = String(q?.id || `gen-${idx + 1}`);
                        const show = Boolean(generatedShowAnswers[id]);
                        const state = generatedChoiceState[id] || {
                          selectedIndex: null,
                          status: "idle"
                        };
                        const choices = Array.isArray(q?.choices) ? q.choices : [];
                        const correctIdx =
                          typeof q?.correctChoiceIndex === "number"
                            ? q.correctChoiceIndex
                            : -1;
                        return (
                          <div key={id} className="plan-card">
                            <span className="tag">Practice {idx + 1}</span>
                            {q?.topic && (
                              <p className="muted" style={{ marginTop: "0.35rem" }}>
                                Focus: {String(q.topic)}
                              </p>
                            )}
                            <p style={{ marginTop: "0.5rem" }}>
                              {String(q?.question || "")}
                            </p>

                            {choices.length === 4 && correctIdx >= 0 && (
                              <div className="stack" style={{ marginTop: "0.75rem" }}>
                                {choices.map((choice, cIdx) => {
                                  const isSelected = state.selectedIndex === cIdx;
                                  const isCorrect = correctIdx === cIdx;
                                  const isLockedCorrect = state.status === "correct";
                                  const buttonClass =
                                    state.status === "correct" && isCorrect
                                      ? "primary"
                                      : "ghost";
                                  return (
                                    <button
                                      key={`${id}-choice-${cIdx}`}
                                      type="button"
                                      className={`${buttonClass} mcq-choice`}
                                      disabled={isLockedCorrect}
                                      onClick={() => {
                                        const nextStatus =
                                          cIdx === correctIdx ? "correct" : "incorrect";
                                        setGeneratedChoiceState((prev) => ({
                                          ...prev,
                                          [id]: { selectedIndex: cIdx, status: nextStatus }
                                        }));
                                      }}
                                      style={{
                                        textAlign: "left",
                                        opacity: isLockedCorrect && !isCorrect ? 0.7 : 1
                                      }}
                                    >
                                      {String.fromCharCode(65 + cIdx)}. {choice}
                                      {isSelected && state.status === "incorrect"
                                        ? " (try again)"
                                        : ""}
                                      {isLockedCorrect && isCorrect ? " (correct)" : ""}
                                    </button>
                                  );
                                })}
                                {state.status === "incorrect" && (
                                  <p className="muted">Incorrect — try again.</p>
                                )}
                                {state.status === "correct" && (
                                  <p className="muted">Correct.</p>
                                )}
                              </div>
                            )}

                            <div className="row" style={{ marginTop: "0.75rem" }}>
                              <button
                                type="button"
                                className="ghost"
                                onClick={() =>
                                  setGeneratedShowAnswers((prev) => ({
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
                                <strong>Answer:</strong>{" "}
                                {String(q?.answer || "")}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
