"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export default function SubtopicLearn() {
  const params = useParams();
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
  const [showAnswers, setShowAnswers] = useState(false);
  const [responses, setResponses] = useState({});
  const [feedback, setFeedback] = useState({});
  const PATH_CACHE_VERSION = "v4-mcq-math";

  const topicPathKey = (slug) =>
    `cramifyTopicPath:${PATH_CACHE_VERSION}:${slug}`;
  const topicStepsKey = (slug) =>
    `cramifyTopicSteps:${PATH_CACHE_VERSION}:${slug}`;

  const slug = params?.slug;
  const stepId = params?.stepId;

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

  const step = useMemo(() => {
    if (!slug || !stepId || !steps.length) return null;
    const match = steps.find(
      (item, index) =>
        (item.id || `${index + 1}`) === stepId &&
        slugify(item.title || "") !== ""
    );
    return match || null;
  }, [slug, stepId, steps]);

  const content = useMemo(() => {
    if (!step || !pathData) return null;
    const moduleNode = Array.isArray(pathData.modules)
      ? pathData.modules.find((mod) =>
          Array.isArray(mod.steps)
            ? mod.steps.some((item) => item.id === step.id)
            : false
        )
      : null;
    const resolved = moduleNode?.steps?.find((item) => item.id === step.id) || null;
    if (!resolved) return null;
    return {
      explanations: resolved.content || [],
      questions: resolved.questions || []
    };
  }, [step, pathData]);

  return (
    <main className="container">
      <header className="header">
        <div>
          <h1>{step?.title || "Learning Step"}</h1>
          <p className="subtitle">Learn the key ideas, then try questions.</p>
        </div>
        <Link className="ghost" href={`/learn/${slug || ""}`}>
          Back
        </Link>
      </header>

      {!plan || !step ? (
        <section className="panel">
          <h2>Step not found</h2>
          <p className="muted">
            Return to the topic plan and select a step to learn.
          </p>
          <Link className="primary" href={`/learn/${slug || ""}`}>
            Back to topic
          </Link>
        </section>
      ) : (
        <section className="panel stack">
          <div className="stack">
            <p className="muted">{step.description}</p>
            {!content && (
              <p className="muted">
                No content found yet. Generate the topic learning path first.
              </p>
            )}
            {content && (
              <div className="stack">
                <div className="stack">
                  {Array.isArray(content?.explanations) &&
                    content.explanations.map((item, index) => (
                      <div key={`${item.title}-${index}`} className="info-card">
                        <span className="info-label">{item.title}</span>
                        <p className="muted">{item.body}</p>
                      </div>
                    ))}
                </div>
                <div className="stack">
                  <div className="row">
                    <h2>Sample questions</h2>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => setShowAnswers((prev) => !prev)}
                    >
                      {showAnswers ? "Hide answers" : "Show answers"}
                    </button>
                  </div>
                  {Array.isArray(content?.questions) &&
                    content.questions.map((question, index) => (
                      <div
                        key={`${question.prompt}-${index}`}
                        className="info-card"
                      >
                        <span className="info-label">Question {index + 1}</span>
                        <strong>{question.prompt}</strong>
                        <div className="stack">
                          <label className="field">
                            <span>Your answer</span>
                            <input
                              type="text"
                              value={responses[index] || ""}
                              onChange={(event) =>
                                setResponses((prev) => ({
                                  ...prev,
                                  [index]: event.target.value
                                }))
                              }
                            />
                          </label>
                          <div className="row">
                            <button
                              type="button"
                              className="ghost tiny"
                              onClick={() => {
                                const expected = (question.answer || "")
                                  .trim()
                                  .toLowerCase();
                                const actual = (responses[index] || "")
                                  .trim()
                                  .toLowerCase();
                                const correct =
                                  expected &&
                                  (actual === expected ||
                                    actual.includes(expected) ||
                                    expected.includes(actual));
                                setFeedback((prev) => ({
                                  ...prev,
                                  [index]: correct
                                    ? "Correct. Nice work."
                                    : "Not quite. Review the explanation and try again."
                                }));
                              }}
                            >
                              Check answer
                            </button>
                            {feedback[index] && (
                              <span className="muted">{feedback[index]}</span>
                            )}
                          </div>
                          {showAnswers && question.answer && (
                            <p className="muted">{question.answer}</p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
