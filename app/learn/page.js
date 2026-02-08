"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const LEVEL_LABELS = {
  0: "Starting from zero",
  1: "Basic familiarity",
  2: "Intermediate",
  3: "Advanced / Review"
};

export default function Learn() {
  const [plan, setPlan] = useState(null);
  const [progressBySlug, setProgressBySlug] = useState({});
  const [batchStatus, setBatchStatus] = useState("idle");
  const [batchError, setBatchError] = useState("");
  const [remainingMs, setRemainingMs] = useState(null);
  const PATH_CACHE_VERSION = "v4-mcq-math";

  const slugify = (value) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

  const topicPathKey = (slug) =>
    `cramifyTopicPath:${PATH_CACHE_VERSION}:${slug}`;
  const topicStepsKey = (slug) =>
    `cramifyTopicSteps:${PATH_CACHE_VERSION}:${slug}`;

  const buildProgress = (topicsList) => {
    const nextProgress = {};
    topicsList.forEach((name) => {
      const slug = slugify(name);
      const statusRaw = sessionStorage.getItem(
        `cramifyTopicStepStatus:${slug}`
      );
      const progressRaw = sessionStorage.getItem(
        `cramifyTopicProgress:${slug}`
      );
      const stepsRaw = sessionStorage.getItem(topicStepsKey(slug));
      let completed = [];
      let total = 0;
      let statusMap = {};
      try {
        statusMap = statusRaw ? JSON.parse(statusRaw) : {};
      } catch {
        statusMap = {};
      }
      try {
        completed = progressRaw ? JSON.parse(progressRaw) : [];
      } catch {
        completed = [];
      }
      try {
        const steps = stepsRaw ? JSON.parse(stepsRaw) : [];
        total = Array.isArray(steps) ? steps.length : 0;
      } catch {
        total = 0;
      }
      const statusCount =
        statusMap && typeof statusMap === "object"
          ? Object.keys(statusMap).length
          : 0;
      const completedCount = statusCount || completed.length;
      nextProgress[slug] = { completed: completedCount, total };
    });
    return nextProgress;
  };

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
    if (!plan) return;
    const topics =
      Array.isArray(plan.topics) && plan.topics.length > 0
        ? plan.topics
        : [];
    if (topics.length === 0) {
      setPlan(null);
      return;
    }
  }, [plan]);

  useEffect(() => {
    if (!plan?.topics?.length) return;
    setProgressBySlug(buildProgress(plan.topics));
  }, [plan]);

  useEffect(() => {
    const examAt = plan?.examAt != null ? Number(plan.examAt) : null;
    if (!examAt) return;
    const tick = () => {
      const next = Math.max(examAt - Date.now(), 0);
      setRemainingMs(next);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [plan]);

  const formatCountdown = (ms) => {
    if (ms == null) return "—";
    const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(seconds).padStart(2, "0")}`;
  };

  const topics = useMemo(() => {
    if (!plan?.topics?.length) return [];
    const allocations = plan.allocations || {};
    return plan.topics
      .map((name) => {
        const entry = allocations[name];
        const hours =
          typeof entry === "number"
            ? entry
            : typeof entry?.hours === "number"
              ? entry.hours
              : null;
        const reason = typeof entry?.reason === "string" ? entry.reason : "";
        const slug = slugify(name);
        const progress = progressBySlug[slug] || { completed: 0, total: 0 };
        const progressRatio =
          progress.total > 0 ? progress.completed / progress.total : 0;
        const remainingHours =
          hours != null ? Math.max(hours * (1 - progressRatio), 0) : null;
        return { name, hours, reason, slug, progressRatio, remainingHours };
      })
      .sort((a, b) => (b.hours || 0) - (a.hours || 0));
  }, [plan, progressBySlug]);

  const generateAllTopics = async () => {
    if (!plan?.topics?.length) return;
    setBatchStatus("loading");
    setBatchError("");
    try {
      const response = await fetch("/api/learn-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course: plan.course,
          level: plan.level,
          topics: plan.topics
        })
      });
      if (!response.ok) {
        const responseClone = response.clone();
        let errorMessage = "Learning path failed.";
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
      const topicMap = result.topics || {};
      const normalizedKeys = Object.keys(topicMap).reduce((acc, key) => {
        acc[slugify(key)] = key;
        return acc;
      }, {});

      const missingTopics = [];
      plan.topics.forEach((topicName) => {
        const slug = slugify(topicName);
        const exact = topicMap[topicName];
        const fallbackKey = normalizedKeys[slug];
        const path = exact || (fallbackKey ? topicMap[fallbackKey] : null);
        if (!path) {
          missingTopics.push(topicName);
          return;
        }
        sessionStorage.setItem(topicPathKey(slug), JSON.stringify(path));
        const modules = Array.isArray(path?.modules) ? path.modules : [];
        const nextSteps = modules.flatMap((module) =>
          Array.isArray(module.steps)
            ? module.steps.map((step) => ({ ...step, moduleId: module.id }))
            : []
        );
        sessionStorage.setItem(topicStepsKey(slug), JSON.stringify(nextSteps));
      });
      if (missingTopics.length > 0) {
        setBatchError(
          `Missing learning paths for: ${missingTopics.join(", ")}`
        );
        setBatchStatus("error");
        return;
      }
      setProgressBySlug(buildProgress(plan.topics));
      setBatchStatus("ready");
    } catch (error) {
      setBatchStatus("error");
      setBatchError(error?.message || "Learning path failed.");
    }
  };

  useEffect(() => {
    if (!plan?.topics?.length) return;
    const hasAnyPath = plan.topics.some((topic) =>
      sessionStorage.getItem(topicPathKey(slugify(topic)))
    );
    if (hasAnyPath || batchStatus === "loading" || batchStatus === "ready") {
      return;
    }
    generateAllTopics();
  }, [plan]);

  return (
    <main className="container">
      <header className="header">
        <div>
          <h1>Learning Plan</h1>
          <p className="subtitle">Start with the most important topics.</p>
        </div>
        <Link className="ghost" href="/roadmap">
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
      ) : (
        <section className="panel">
          <h2>{plan.course}</h2>
          <p className="muted">
            Total time: {plan.hoursAvailable} hours · Time remaining:{" "}
            {formatCountdown(remainingMs)} · Level:{" "}
            {LEVEL_LABELS[plan.level] || LEVEL_LABELS[0]}
          </p>
          <div className="helper">
            {batchStatus === "loading" && (
              <p className="muted">Generating learning plans...</p>
            )}
            {batchStatus === "ready" && (
              <p className="muted">Learning plans generated.</p>
            )}
          </div>
          {batchStatus === "error" && (
            <div className="row">
              <span className="muted">{batchError}</span>
              <button
                type="button"
                className="ghost"
                onClick={generateAllTopics}
              >
                Try again
              </button>
            </div>
          )}
          <div className="roadmap-grid">
            {topics.map((topic, index) => (
              <div key={`${topic.name}-${index}`} className="plan-card">
                <div className="topic-header">
                  <div>
                    <span className="tag">Topic {index + 1}</span>
                    <h3>{topic.name}</h3>
                  </div>
                  <div className="topic-hours">
                    <span className="info-label">Focus time</span>
                    <strong>
                      {topic.hours != null ? `${topic.hours.toFixed(1)}h` : "—"}
                    </strong>
                    {topic.reason && <p className="ai-reason">{topic.reason}</p>}
                  </div>
                </div>
                <div className="stack">
                  <div className="progress">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${topic.progressRatio * 100}%`,
                          background:
                            topic.progressRatio >= 0.8
                              ? "#22c55e"
                              : topic.progressRatio >= 0.5
                                ? "#f59e0b"
                                : "#ef4444"
                        }}
                      />
                    </div>
                    <span className="muted">
                      {Math.round(topic.progressRatio * 100)}% complete ·{" "}
                      {topic.remainingHours != null
                        ? `${topic.remainingHours.toFixed(1)}h remaining`
                        : "Remaining time pending"}
                    </span>
                  </div>
                  <p className="muted">
                    Start with core definitions, then work through a few
                    representative problems, and finish with a summary sheet.
                  </p>
                  {topic.progressRatio >= 1 ? (
                    <p className="pill" style={{ color: "#22c55e" }}>
                      Topic has been completed.
                    </p>
                  ) : (
                    <Link className="primary" href={`/learn/${topic.slug}`}>
                      Start learning this topic
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
