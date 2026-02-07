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
  const [hasFetched, setHasFetched] = useState(false);
  const [pathData, setPathData] = useState(null);

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
    const slug = params?.slug;
    if (!plan?.topics?.length || !slug) return;
    const stepsRaw = sessionStorage.getItem(`cramifyTopicSteps:${slug}`);
    const pathRaw = sessionStorage.getItem(`cramifyTopicPath:${slug}`);
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
    if (pathRaw) {
      try {
        setPathData(JSON.parse(pathRaw));
      } catch {
        setPathData(null);
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

  const loadSteps = async () => {
    const slug = params?.slug;
    if (!plan?.topics?.length || !slug) return;
    const match = plan.topics.find((name) => slugify(name) === slug);
    if (!match) return;
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
      setPathData(result);
      sessionStorage.setItem(`cramifyTopicPath:${slug}`, JSON.stringify(result));
      const modules = Array.isArray(result?.modules) ? result.modules : [];
      const nextSteps = modules.flatMap((module) =>
        Array.isArray(module.steps)
          ? module.steps.map((step) => ({ ...step, moduleId: module.id }))
          : []
      );
      setSteps(nextSteps);
      sessionStorage.setItem(
        `cramifyTopicSteps:${slug}`,
        JSON.stringify(nextSteps)
      );
      setStatus("ready");
      setHasFetched(true);
    } catch (error) {
      setStatus("error");
      setError(error?.message || "Learning plan failed.");
      setHasFetched(true);
    }
  };

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
            {status === "idle" && stepsWithIds.length === 0 && (
              <button type="button" className="primary" onClick={loadSteps}>
                Generate step-by-step guide
              </button>
            )}
            {status === "error" && (
              <p className="muted">AI unavailable. {error}</p>
            )}
            {status !== "loading" && hasFetched && stepsWithIds.length === 0 && (
              <p className="muted">
                No steps found yet. Try reloading the page.
              </p>
            )}
            {pathData?.overview && (
              <div className="info-card">
                <span className="info-label">Overview</span>
                <p className="muted">{pathData.overview}</p>
              </div>
            )}
            {Array.isArray(pathData?.modules) && pathData.modules.length > 0 && (
              <div className="stack">
                {pathData.modules.map((module) => (
                  <div key={module.id} className="info-card stack">
                    <div>
                      <span className="info-label">Module {module.id}</span>
                      <strong>{module.title}</strong>
                    </div>
                    {module.summary && <p className="muted">{module.summary}</p>}
                    <div className="checklist">
                      {Array.isArray(module.steps) &&
                        module.steps.map((step) => (
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
                            <div className="stack">
                              <strong>{step.title}</strong>
                              {Array.isArray(step.content) && (
                                <div className="stack">
                                  {step.content.map((item, index) => (
                                    <div
                                      key={`${item.title}-${index}`}
                                      className="info-card"
                                    >
                                      <span className="info-label">
                                        {item.title}
                                      </span>
                                      <p className="muted">{item.body}</p>
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
                                      <strong>{question.prompt}</strong>
                                      {question.answer && (
                                        <p className="muted">
                                          {question.answer}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
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
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
