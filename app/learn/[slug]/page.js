"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { BlockMath, InlineMath } from "react-katex";

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const renderInlineMath = (text, keyPrefix) => {
  const parts = text.split(/(\$[^$]+\$)/g);
  return parts.map((part, index) => {
    if (part.startsWith("$") && part.endsWith("$")) {
      return (
        <InlineMath key={`${keyPrefix}-${index}`}>
          {part.slice(1, -1)}
        </InlineMath>
      );
    }
    if (!part) return null;
    return <span key={`${keyPrefix}-${index}`}>{part}</span>;
  });
};

const renderMath = (value) => {
  const text = String(value ?? "");
  const parts = text.split(/(\$\$[\s\S]+?\$\$)/g);
  return parts.map((part, index) => {
    if (part.startsWith("$$") && part.endsWith("$$")) {
      return (
        <BlockMath key={`block-${index}`}>
          {part.slice(2, -2)}
        </BlockMath>
      );
    }
    return renderInlineMath(part, `inline-${index}`);
  });
};

export default function TopicLearn() {
  const params = useParams();
  const slug = params?.slug;
  const [plan] = useState(() => {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem("cramifyAiPlan");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });
  const [stepStatus, setStepStatus] = useState(() => {
    if (typeof window === "undefined") return {};
    if (!slug) return {};
    const statusRaw = sessionStorage.getItem(`cramifyTopicStepStatus:${slug}`);
    const progressRaw = sessionStorage.getItem(`cramifyTopicProgress:${slug}`);
    if (statusRaw) {
      try {
        const parsed = JSON.parse(statusRaw);
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch {
        return {};
      }
    }
    if (progressRaw) {
      try {
        const parsed = JSON.parse(progressRaw);
        if (Array.isArray(parsed)) {
          return parsed.reduce((acc, id) => {
            acc[id] = "done";
            return acc;
          }, {});
        }
        return {};
      } catch {
        return {};
      }
    }
    return {};
  });
  const [questionAnswers, setQuestionAnswers] = useState(() => {
    if (typeof window === "undefined") return {};
    if (!slug) return {};
    const raw = sessionStorage.getItem(`cramifyQuestionState:v1:${slug}`);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed?.questionAnswers || {};
    } catch {
      return {};
    }
  });
  const [answerVisible, setAnswerVisible] = useState(() => {
    if (typeof window === "undefined") return {};
    if (!slug) return {};
    const raw = sessionStorage.getItem(`cramifyQuestionState:v1:${slug}`);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed?.answerVisible || {};
    } catch {
      return {};
    }
  });
  const [answerFeedback, setAnswerFeedback] = useState(() => {
    if (typeof window === "undefined") return {};
    if (!slug) return {};
    const raw = sessionStorage.getItem(`cramifyQuestionState:v1:${slug}`);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed?.answerFeedback || {};
    } catch {
      return {};
    }
  });
  const [answerMessage, setAnswerMessage] = useState(() => {
    if (typeof window === "undefined") return {};
    if (!slug) return {};
    const raw = sessionStorage.getItem(`cramifyQuestionState:v1:${slug}`);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed?.answerMessage || {};
    } catch {
      return {};
    }
  });
  const PATH_CACHE_VERSION = "v4-mcq-math";
  const QUESTION_STATE_VERSION = "v1";

  const topicPathKey = (slug) =>
    `cramifyTopicPath:${PATH_CACHE_VERSION}:${slug}`;
  const topicStepsKey = (slug) =>
    `cramifyTopicSteps:${PATH_CACHE_VERSION}:${slug}`;

  const steps = useMemo(() => {
    if (typeof window === "undefined") return [];
    if (!slug) return [];
    const stepsRaw = sessionStorage.getItem(topicStepsKey(slug));
    if (!stepsRaw) return [];
    try {
      const parsed = JSON.parse(stepsRaw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [slug]);

  const pathData = useMemo(() => {
    if (typeof window === "undefined") return null;
    if (!slug) return null;
    const pathRaw = sessionStorage.getItem(topicPathKey(slug));
    if (!pathRaw) return null;
    try {
      return JSON.parse(pathRaw);
    } catch {
      return null;
    }
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    sessionStorage.setItem(
      `cramifyTopicStepStatus:${slug}`,
      JSON.stringify(stepStatus)
    );
  }, [stepStatus, slug]);

  useEffect(() => {
    if (!slug) return;
    sessionStorage.setItem(
      `cramifyQuestionState:${QUESTION_STATE_VERSION}:${slug}`,
      JSON.stringify({
        questionAnswers,
        answerFeedback,
        answerMessage,
        answerVisible
      })
    );
  }, [
    questionAnswers,
    answerFeedback,
    answerMessage,
    answerVisible,
    slug,
    QUESTION_STATE_VERSION
  ]);

  const topic = useMemo(() => {
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
  }, [plan, slug]);

  const nextTopicSlug = useMemo(() => {
    if (!plan?.topics?.length || !slug) return null;
    const index = plan.topics.findIndex((name) => slugify(name) === slug);
    if (index === -1) return null;
    const nextIndex = (index + 1) % plan.topics.length;
    return slugify(plan.topics[nextIndex]);
  }, [plan, slug]);

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

  const { stepComplete, moduleComplete } = useMemo(() => {
    const stepMap = {};
    const moduleMap = {};
    const modules = Array.isArray(pathData?.modules) ? pathData.modules : [];
    modules.forEach((module) => {
      let moduleAll = true;
      const moduleSteps = Array.isArray(module.steps) ? module.steps : [];
      if (moduleSteps.length === 0) moduleAll = false;
      moduleSteps.forEach((step) => {
        const questions = Array.isArray(step.questions) ? step.questions : [];
        const allCorrect =
          questions.length > 0 &&
          questions.every(
            (_, index) => answerFeedback[step.id]?.[index] === "correct"
          );
        stepMap[step.id] = allCorrect;
        if (!allCorrect) moduleAll = false;
      });
      moduleMap[module.id] = moduleAll;
    });
    return { stepComplete: stepMap, moduleComplete: moduleMap };
  }, [pathData, answerFeedback]);

  const effectiveStepStatus = useMemo(() => {
    const next = { ...(stepStatus || {}) };
    const modules = Array.isArray(pathData?.modules) ? pathData.modules : [];
    modules.forEach((module) => {
      if (!moduleComplete[module.id]) return;
      const moduleSteps = Array.isArray(module.steps) ? module.steps : [];
      moduleSteps.forEach((step) => {
        if (step?.id) next[step.id] = "done";
      });
    });
    return next;
  }, [stepStatus, pathData, moduleComplete]);

  const progressRatio =
    stepsWithIds.length > 0
      ? Object.keys(effectiveStepStatus).length / stepsWithIds.length
      : 0;
  const remainingHours =
    topic?.hours != null
      ? Math.max(topic.hours * (1 - progressRatio), 0)
      : null;

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
                style={{
                  width: `${progressRatio * 100}%`,
                  background:
                    progressRatio >= 0.8
                      ? "#22c55e"
                      : progressRatio >= 0.5
                        ? "#f59e0b"
                        : "#ef4444"
                }}
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
            {!pathData && (
              <p className="muted">
                No learning path found yet. Go back to the learning plan to
                generate all topics.
              </p>
            )}
            {pathData?.overview && (
              <div className="info-card">
                <span className="info-label">Overview</span>
                <p className="muted">{renderMath(pathData.overview)}</p>
              </div>
            )}
            {Array.isArray(pathData?.modules) && pathData.modules.length > 0 && (
              <div className="stack">
                {pathData.modules.map((module) => (
                  <div key={module.id} className="info-card stack">
                    <div>
                      <span className="info-label">Module {module.id}</span>
                      <strong>{renderMath(module.title)}</strong>
                    </div>
                    {module.summary && (
                      <p className="muted">{renderMath(module.summary)}</p>
                    )}
                    <div className="checklist">
                      {Array.isArray(module.steps) &&
                        module.steps.map((step) => (
                          <div key={step.id} className="checklist-item">
                            <input
                              type="checkbox"
                              checked={
                                moduleComplete[module.id] ||
                                Boolean(effectiveStepStatus[step.id]) ||
                                stepComplete[step.id]
                              }
                              disabled={moduleComplete[module.id]}
                              onChange={(event) => {
                                if (moduleComplete[module.id]) return;
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
                            <div className="stack">
                              <strong>{renderMath(step.title)}</strong>
                              {Array.isArray(step.content) && (
                                <div className="stack">
                                  {step.content.map((item, index) => (
                                    <div
                                      key={`${item.title}-${index}`}
                                      className="info-card"
                                    >
                                      <span className="info-label">
                                        {renderMath(item.title)}
                                      </span>
                                      <p className="muted">
                                        {renderMath(item.body)}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {Array.isArray(step.questions) && (
                                <div className="stack">
                                  <span className="info-label">
                                    Sample questions
                                  </span>
                                  {step.questions.map((question, index) => (
                                    <div
                                      key={`${question.prompt}-${index}`}
                                      className="info-card"
                                    >
                                      <strong>{renderMath(question.prompt)}</strong>
                                      <div className="stack">
                                        <div className="stack">
                                          {Array.isArray(question.options) &&
                                            question.options.map((option, optIdx) => (
                                              <label
                                                key={`${option}-${optIdx}`}
                                                className="mcq-option"
                                              >
                                                <input
                                                  type="radio"
                                                  name={`${step.id}-${index}`}
                                                  checked={
                                                    questionAnswers[step.id]?.[index] ===
                                                    optIdx
                                                  }
                                                  disabled={Boolean(
                                                    answerFeedback[step.id]?.[index]
                                                  )}
                                                  onChange={() =>
                                                    setQuestionAnswers((prev) => ({
                                                      ...prev,
                                                      [step.id]: {
                                                        ...(prev[step.id] || {}),
                                                        [index]: optIdx
                                                      }
                                                    }))
                                                  }
                                                />
                                                <span>{renderMath(option)}</span>
                                                {answerFeedback[step.id]?.[index] &&
                                                  questionAnswers[step.id]?.[index] ===
                                                    optIdx && (
                                                  <span
                                                    className={
                                                      answerFeedback[step.id][index] ===
                                                      "correct"
                                                        ? "mcq-mark success"
                                                        : "mcq-mark error"
                                                    }
                                                  >
                                                    {answerFeedback[step.id][index] ===
                                                    "correct"
                                                      ? "✔"
                                                      : "✖"}
                                                  </span>
                                                )}
                                              </label>
                                            ))}
                                        </div>
                                        <div className="row">
                                          {!answerFeedback[step.id]?.[index] && (
                                            <button
                                              type="button"
                                              className="ghost tiny"
                                              onClick={() => {
                                                const selected =
                                                  questionAnswers[step.id]?.[index];
                                              if (!Number.isInteger(selected)) {
                                                return;
                                              }
                                              const correctIndex = Number.isInteger(
                                                question.correctIndex
                                              )
                                                ? question.correctIndex
                                                : Number(question.correctIndex);
                                              const correct =
                                                Number.isInteger(selected) &&
                                                Number.isInteger(correctIndex) &&
                                                selected === correctIndex;
                                              setQuestionAnswers((prev) => ({
                                                ...prev,
                                                [step.id]: {
                                                  ...(prev[step.id] || {}),
                                                  [index]: selected
                                                }
                                              }));
                                              setAnswerFeedback((prev) => ({
                                                ...prev,
                                                [step.id]: {
                                                  ...(prev[step.id] || {}),
                                                  [index]: correct
                                                    ? "correct"
                                                    : "incorrect"
                                                }
                                              }));
                                              setAnswerMessage((prev) => ({
                                                ...prev,
                                                [step.id]: {
                                                  ...(prev[step.id] || {}),
                                                  [index]: correct
                                                    ? "Good job! Correct."
                                                    : "Try again."
                                                }
                                              }));
                                              }}
                                            >
                                              Check answer
                                            </button>
                                          )}
                                          {answerFeedback[step.id]?.[index] ===
                                            "incorrect" && (
                                            <button
                                              type="button"
                                              className="ghost tiny"
                                              onClick={() => {
                                                setAnswerFeedback((prev) => ({
                                                  ...prev,
                                                  [step.id]: {
                                                    ...(prev[step.id] || {}),
                                                    [index]: undefined
                                                  }
                                                }));
                                                setAnswerMessage((prev) => ({
                                                  ...prev,
                                                  [step.id]: {
                                                    ...(prev[step.id] || {}),
                                                    [index]: undefined
                                                  }
                                                }));
                                                setQuestionAnswers((prev) => ({
                                                  ...prev,
                                                  [step.id]: {
                                                    ...(prev[step.id] || {}),
                                                    [index]: undefined
                                                  }
                                                }));
                                              }}
                                            >
                                              Try again
                                            </button>
                                          )}
                                          {answerFeedback[step.id]?.[index] !==
                                            "correct" && (
                                            <button
                                              type="button"
                                              className="ghost tiny"
                                              onClick={() =>
                                                setAnswerVisible((prev) => ({
                                                  ...prev,
                                                  [step.id]: {
                                                    ...(prev[step.id] || {}),
                                                    [index]:
                                                      !prev[step.id]?.[index]
                                                  }
                                                }))
                                              }
                                            >
                                              {answerVisible[step.id]?.[index]
                                                ? "Hide answer"
                                                : "Show answer"}
                                            </button>
                                          )}
                                        </div>
                                        {answerMessage[step.id]?.[index] && (
                                          <p className="muted">
                                            {answerMessage[step.id][index]}
                                          </p>
                                        )}
                                        {answerVisible[step.id]?.[index] &&
                                          answerFeedback[step.id]?.[index] !==
                                            "correct" &&
                                          Array.isArray(question.options) && (
                                            <p className="muted">
                                              Answer:{" "}
                                              {renderMath(
                                                question.options[
                                                  Number.isInteger(question.correctIndex)
                                                    ? question.correctIndex
                                                    : Number(question.correctIndex)
                                                ] || "—"
                                              )}
                                            </p>
                                          )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {!moduleComplete[module.id] && (
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
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="row">
              <Link className="ghost" href="/learn">
                Back to menu
              </Link>
              {progressRatio < 1 && nextTopicSlug && (
                <Link className="primary" href={`/learn/${nextTopicSlug}`}>
                  Next topic
                </Link>
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
