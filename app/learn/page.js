"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export default function Learn() {
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

  const slugify = (value) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

  const progressBySlug = useMemo(() => {
    if (typeof window === "undefined") return {};
    if (!plan?.topics?.length) return {};
    const nextProgress = {};
    plan.topics.forEach((name) => {
      const slug = slugify(name);
      const statusRaw = sessionStorage.getItem(
        `cramifyTopicStepStatus:${slug}`
      );
      const progressRaw = sessionStorage.getItem(
        `cramifyTopicProgress:${slug}`
      );
      const stepsRaw = sessionStorage.getItem(`cramifyTopicSteps:${slug}`);
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
  }, [plan]);

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
            Total time: {plan.hoursAvailable} hours · Level:{" "}
            {plan.level ?? "0"}
          </p>
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
                        style={{ width: `${topic.progressRatio * 100}%` }}
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
                  <Link className="primary" href={`/learn/${topic.slug}`}>
                    Start learning this topic
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
