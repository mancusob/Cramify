"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const LEVEL_LABELS = {
  0: "Starting from zero",
  1: "Basic familiarity",
  2: "Intermediate",
  3: "Advanced / Review"
};

function parseTopics(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((topic) => String(topic).trim()).filter(Boolean);
  }
  return String(raw)
    .split(/[\n,]+/g)
    .map((topic) => topic.trim())
    .filter(Boolean);
}

export default function Roadmap() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [stored, setStored] = useState(null);
  const [topicMeta, setTopicMeta] = useState([]);
  const [aiAllocations, setAiAllocations] = useState(null);
  const [aiStatus, setAiStatus] = useState("idle");
  const [aiError, setAiError] = useState("");
  const [aiClearedNotice, setAiClearedNotice] = useState(false);
  const [aiBlocked, setAiBlocked] = useState(false);
  const [remainingMs, setRemainingMs] = useState(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("cramifyRoadmap");
    if (raw) {
      try {
        setStored(JSON.parse(raw));
      } catch (error) {
        setStored(null);
      }
    }
  }, []);

  useEffect(() => {
    const hasParams = ["course", "level", "hoursUntil", "hoursAvailable", "topics"]
      .map((key) => searchParams.get(key))
      .some((value) => value != null);
    if (!hasParams) return;

    const course = searchParams.get("course") || "Your course";
    const level = searchParams.get("level") || "0";
    const hoursUntil = searchParams.get("hoursUntil") || "—";
    const hoursAvailable = searchParams.get("hoursAvailable") || "—";
    const topics = parseTopics(searchParams.get("topics") || "");
    const createdAt = stored?.createdAt ?? Date.now();
    const examAt =
      stored?.examAt ??
      (Number(hoursUntil) > 0
        ? createdAt + Number(hoursUntil) * 60 * 60 * 1000
        : null);

    const nextStored = {
      course,
      level,
      hoursUntil,
      hoursAvailable,
      topics,
      createdAt,
      examAt
    };

    if (JSON.stringify(nextStored) === JSON.stringify(stored)) {
      return;
    }

    setStored(nextStored);
    sessionStorage.setItem("cramifyRoadmap", JSON.stringify(nextStored));
    sessionStorage.setItem(
      "cramifyAiPlan",
      JSON.stringify({
        course,
        level,
        hoursUntil,
        hoursAvailable,
        topics,
        allocations: {}
      })
    );
  }, [searchParams, stored]);

  const data = useMemo(() => {
    const course = stored?.course || searchParams.get("course") || "Your course";
    const level = stored?.level || searchParams.get("level") || "0";
    const hoursUntil = stored?.hoursUntil || searchParams.get("hoursUntil") || "—";
    const hoursAvailable =
      stored?.hoursAvailable || searchParams.get("hoursAvailable") || "—";
    const topics = parseTopics(stored?.topics || searchParams.get("topics") || "");
    return { course, level, hoursUntil, hoursAvailable, topics };
  }, [searchParams, stored]);

  useEffect(() => {
    if (!stored?.examAt && !data.hoursUntil) return;
    const examAt =
      stored?.examAt != null
        ? Number(stored.examAt)
        : Number(data.hoursUntil) > 0
          ? Date.now() + Number(data.hoursUntil) * 60 * 60 * 1000
          : null;
    if (!examAt) return;
    const tick = () => {
      const next = Math.max(examAt - Date.now(), 0);
      setRemainingMs(next);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [stored, data.hoursUntil]);

  const hoursUntilDisplay =
    remainingMs != null
      ? `${Math.max(remainingMs / 3600000, 0).toFixed(1)}`
      : data.hoursUntil;

  useEffect(() => {
    setTopicMeta((prev) =>
      data.topics.map((name) => {
        const existing = prev.find((topic) => topic.name === name);
        return (
          existing || {
            name,
            complexity: 3,
            importance: 3,
            weighting: 3
          }
        );
      })
    );
  }, [data.topics]);

  const hoursAvailableNumber = Number(data.hoursAvailable || 0);
  const hoursUntilNumber =
    remainingMs != null
      ? Math.max(remainingMs / 3600000, 0)
      : Number(data.hoursUntil || 0);
  const allocations = useMemo(() => {
    const scores = topicMeta.map(
      (topic) => topic.complexity * topic.importance * topic.weighting
    );
    const totalScore = scores.reduce((sum, score) => sum + score, 0);
    return topicMeta.map((topic, index) => {
      const score = scores[index] || 0;
      const share =
        totalScore > 0 ? (score / totalScore) * hoursAvailableNumber : 0;
      return { ...topic, score, hours: share };
    });
  }, [topicMeta, hoursAvailableNumber]);

  const getAiHours = (topicName) => {
    const entry = aiAllocations?.[topicName];
    if (entry == null) return null;
    if (typeof entry === "number") return entry;
    if (typeof entry === "object" && typeof entry.hours === "number") {
      return entry.hours;
    }
    return null;
  };

  const getAiReason = (topicName) => {
    const entry = aiAllocations?.[topicName];
    if (entry && typeof entry === "object" && typeof entry.reason === "string") {
      return entry.reason;
    }
    return "";
  };

  const updateTopicMeta = (topicName, field, value) => {
    setTopicMeta((prev) =>
      prev.map((item) =>
        item.name === topicName ? { ...item, [field]: value } : item
      )
    );
    if (aiAllocations) {
      setAiAllocations(null);
      setAiStatus("idle");
      setAiError("");
      setAiClearedNotice(true);
    }
  };

  const fetchAiAllocation = async () => {
    if (!data.topics.length || hoursAvailableNumber <= 0) return;
    setAiStatus("loading");
    setAiError("");
    setAiClearedNotice(false);
    const cacheKey = JSON.stringify({
      course: data.course,
      level: data.level,
      hoursUntil: data.hoursUntil,
      hoursAvailable: hoursAvailableNumber,
      topics: data.topics
    });
    const cached = sessionStorage.getItem(`cramifyAiAlloc:${cacheKey}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setAiAllocations(parsed || null);
        setAiStatus("ready");
        setAiError("");
        return;
      } catch {
        // ignore cache parse errors
      }
    }
    try {
      const response = await fetch("/api/allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course: data.course,
          level: data.level,
          hoursUntil: hoursUntilNumber.toFixed(1),
          hoursAvailable: hoursAvailableNumber,
          topics: topicMeta.map((topic) => ({
            name: topic.name
          }))
        })
      });

      if (!response.ok) {
        const responseClone = response.clone();
        let errorMessage = "Allocation failed.";
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
      setAiAllocations(result.allocations || null);
      setAiStatus("ready");
      setAiError("");
      sessionStorage.setItem(
        `cramifyAiAlloc:${cacheKey}`,
        JSON.stringify(result.allocations || null)
      );
      setAiClearedNotice(false);
      sessionStorage.setItem(
        "cramifyAiPlan",
        JSON.stringify({
          course: data.course,
          level: data.level,
          hoursUntil: data.hoursUntil,
          hoursAvailable: data.hoursAvailable,
          topics: data.topics,
          allocations: result.allocations || {}
        })
      );
      router.push("/learn");
    } catch (error) {
      setAiAllocations(null);
      setAiStatus("error");
      setAiError(error?.message || "Allocation failed.");
      if (String(error?.message || "").toLowerCase().includes("quota")) {
        setAiBlocked(true);
      }
      setAiClearedNotice(false);
    }
  };

  return (
    <main className="container">
      <header className="header">
        <div>
          <h1>Roadmap</h1>
          <p className="subtitle">
            A focused path based on your inputs.
          </p>
        </div>
        <Link className="ghost" href="/">
          Back
        </Link>
      </header>

      <section className="panel">
        <h2>Overview</h2>
        <div className="grid">
          <div className="info-card">
            <span className="info-label">Course</span>
            <strong>{data.course}</strong>
          </div>
          <div className="info-card">
            <span className="info-label">Knowledge level</span>
            <strong>{LEVEL_LABELS[data.level] || LEVEL_LABELS[0]}</strong>
          </div>
          <div className="info-card">
            <span className="info-label">Hours until exam</span>
            <strong>
              {hoursUntilDisplay !== "—" ? `${hoursUntilDisplay}h` : "—"}
            </strong>
          </div>
          <div className="info-card">
            <span className="info-label">Hours available</span>
            <strong>{data.hoursAvailable}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Topic Roadmap</h2>
        <p className="muted">
          Allocation prioritizes high-impact topics using complexity, importance
          for other topics, and exam weighting.
        </p>
        <div className="row">
          <button
            type="button"
            className="primary"
            onClick={fetchAiAllocation}
            disabled={aiStatus === "loading" || aiBlocked}
          >
            {aiStatus === "loading"
              ? "Calculating..."
              : aiBlocked
                ? "AI quota reached"
                : "AI recommended time allocations"}
          </button>
          <Link className="ghost" href="/learn">
            Continue to learning plan
          </Link>
          {aiStatus === "error" && (
            <span className="muted">
              AI unavailable.
              {aiError ? ` ${aiError}` : " Using local estimates."}
            </span>
          )}
          {aiClearedNotice && (
            <span className="muted">AI recommendation cleared due to edits.</span>
          )}
          {aiStatus === "ready" && (
            <span className="muted">AI recommendations loaded.</span>
          )}
        </div>
        {data.topics.length === 0 ? (
          <p className="muted">
            No topics provided yet. Go back and add your topics to see a
            roadmap.
          </p>
        ) : (
          <div className="roadmap-grid">
            {allocations.map((topic, index) => (
              <div key={`${topic.name}-${index}`} className="plan-card">
                <div className="topic-header">
                  <div>
                    <span className="tag">Topic {index + 1}</span>
                    <h3>{topic.name}</h3>
                  </div>
                  <div className="topic-hours">
                    <span className="info-label">Estimated time</span>
                    <strong>
                      {getAiHours(topic.name) != null
                        ? `${getAiHours(topic.name).toFixed(1)}h`
                        : hoursAvailableNumber > 0
                          ? `${Math.max(topic.hours, 0.5).toFixed(1)}h`
                          : "—"}
                    </strong>
                    {getAiReason(topic.name) && (
                      <p className="ai-reason">{getAiReason(topic.name)}</p>
                    )}
                  </div>
                </div>

                <div className="slider-grid">
                  <label className="field compact">
                    <span>Complexity</span>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={topic.complexity}
                      onChange={(event) =>
                        updateTopicMeta(
                          topic.name,
                          "complexity",
                          Number(event.target.value)
                        )
                      }
                    />
                  </label>
                  <label className="field compact">
                    <span>Importance</span>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={topic.importance}
                      onChange={(event) =>
                        updateTopicMeta(
                          topic.name,
                          "importance",
                          Number(event.target.value)
                        )
                      }
                    />
                  </label>
                  <label className="field compact">
                    <span>Exam weight</span>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={topic.weighting}
                      onChange={(event) =>
                        updateTopicMeta(
                          topic.name,
                          "weighting",
                          Number(event.target.value)
                        )
                      }
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
