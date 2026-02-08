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

export default function RoadmapClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [stored, setStored] = useState(null);
  const [topicMeta, setTopicMeta] = useState([]);
  const [aiAllocations, setAiAllocations] = useState(null);
  const [aiStatus, setAiStatus] = useState("idle");
  const [aiError, setAiError] = useState("");
  const [aiClearedNotice, setAiClearedNotice] = useState(false);
  const [hasExamBank] = useState(() => {
    if (typeof window === "undefined") return false;
    const raw = sessionStorage.getItem("cramifyExamBank");
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      return Boolean(parsed && Array.isArray(parsed.items) && parsed.items.length);
    } catch {
      return false;
    }
  });
  const [aiBlocked, setAiBlocked] = useState(false);
  const [aiLoadedFromAction, setAiLoadedFromAction] = useState(false);
  const [remainingMs, setRemainingMs] = useState(null);
  const [topicMetaInitialized, setTopicMetaInitialized] = useState(false);

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

    let allocations = {};
    try {
      const rawPlan = sessionStorage.getItem("cramifyAiPlan");
      const parsedPlan = rawPlan ? JSON.parse(rawPlan) : null;
      if (parsedPlan?.allocations && Object.keys(parsedPlan.allocations).length) {
        allocations = parsedPlan.allocations;
      }
    } catch {
      // ignore parse errors
    }

    const nextAiPlan = {
      course,
      level,
      hoursUntil,
      hoursAvailable,
      topics,
      allocations,
      createdAt,
      examAt
    };
    sessionStorage.setItem("cramifyAiPlan", JSON.stringify(nextAiPlan));
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

  const hoursUntilDisplay =
    remainingMs != null ? formatCountdown(remainingMs) : data.hoursUntil;

  useEffect(() => {
    if (!data.topics.length) return;
    if (topicMetaInitialized) return;
    let storedMap = {};
    try {
      const raw = sessionStorage.getItem("cramifyTopicMeta");
      const parsed = raw ? JSON.parse(raw) : {};
      if (Array.isArray(parsed)) {
        storedMap = parsed.reduce((acc, topic) => {
          if (topic?.name) acc[topic.name] = topic;
          return acc;
        }, {});
      } else if (parsed && typeof parsed === "object") {
        storedMap = parsed;
      }
    } catch {
      storedMap = {};
    }
    if (stored?.topicMeta && typeof stored.topicMeta === "object") {
      storedMap = { ...storedMap, ...stored.topicMeta };
    }
    setTopicMeta(
      data.topics.map((name) => {
        const storedItem = storedMap?.[name];
        return (
          storedItem || {
            name,
            complexity: 3,
            importance: 3,
            weighting: 3
          }
        );
      })
    );
    setTopicMetaInitialized(true);
  }, [data.topics, topicMetaInitialized, stored]);

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

  const localAllocations = useMemo(() => {
    const map = {};
    allocations.forEach((topic) => {
      map[topic.name] = Math.max(topic.hours, 0.5);
    });
    return map;
  }, [allocations]);

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

  const persistTopicMeta = (nextMeta) => {
    if (!nextMeta.length) return;
    const map = nextMeta.reduce((acc, topic) => {
      acc[topic.name] = topic;
      return acc;
    }, {});
    sessionStorage.setItem("cramifyTopicMeta", JSON.stringify(map));
    try {
      const raw = sessionStorage.getItem("cramifyRoadmap");
      const parsed = raw ? JSON.parse(raw) : {};
      sessionStorage.setItem(
        "cramifyRoadmap",
        JSON.stringify({ ...parsed, topicMeta: map })
      );
    } catch {
      // ignore parse errors
    }
  };

  const updateTopicMeta = (topicName, field, value) => {
    setTopicMeta((prev) => {
      const next = prev.map((item) =>
        item.name === topicName ? { ...item, [field]: value } : item
      );
      persistTopicMeta(next);
      return next;
    });
    if (aiAllocations) {
      setAiAllocations(null);
      setAiStatus("idle");
      setAiError("");
      setAiClearedNotice(true);
    }
  };

  const resetTopicMeta = () => {
    setTopicMeta((prev) => {
      const next = prev.map((topic) => ({
        ...topic,
        complexity: 3,
        importance: 3,
        weighting: 3,
        progress: 0
      }));
      persistTopicMeta(next);
      return next;
    });
    setAiAllocations(null);
    setAiStatus("idle");
    setAiError("");
    setAiClearedNotice(false);
  };

  useEffect(() => {
    if (!topicMeta.length) return;
    persistTopicMeta(topicMeta);
  }, [topicMeta]);

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
      setAiClearedNotice(false);
      setAiLoadedFromAction(true);
      sessionStorage.setItem(
        `cramifyAiAlloc:${cacheKey}`,
        JSON.stringify(result.allocations || null)
      );
      sessionStorage.setItem(
        "cramifyAiPlan",
        JSON.stringify({
          course: data.course,
          level: data.level,
          hoursUntil: hoursUntilNumber.toFixed(1),
          hoursAvailable: data.hoursAvailable,
          topics: data.topics,
          allocations: result.allocations || {},
          createdAt: stored?.createdAt ?? Date.now(),
          examAt:
            stored?.examAt ??
            (Number(data.hoursUntil) > 0
              ? Date.now() + Number(data.hoursUntil) * 60 * 60 * 1000
              : null)
        })
      );
      router.push("/learn");
    } catch (error) {
      setAiAllocations(null);
      setAiStatus("error");
      setAiError(error?.message || "Allocation failed.");
      setAiClearedNotice(false);
      if (String(error?.message || "").toLowerCase().includes("quota")) {
        setAiBlocked(true);
      }
    }
  };

  useEffect(() => {
    if (!data.topics.length) return;
    let persistedAllocations = null;
    try {
      const rawPlan = sessionStorage.getItem("cramifyAiPlan");
      const parsed = rawPlan ? JSON.parse(rawPlan) : null;
      if (parsed?.allocations && Object.keys(parsed.allocations).length) {
        persistedAllocations = parsed.allocations;
      }
    } catch {
      persistedAllocations = null;
    }
    const allocationsForPlan =
      aiAllocations || persistedAllocations || localAllocations;
    if (!aiAllocations && persistedAllocations) {
      setAiAllocations(persistedAllocations);
    }
    sessionStorage.setItem(
      "cramifyAiPlan",
      JSON.stringify({
        course: data.course,
        level: data.level,
        hoursUntil: hoursUntilNumber.toFixed(1),
        hoursAvailable: data.hoursAvailable,
        topics: data.topics,
        allocations: allocationsForPlan,
        createdAt: stored?.createdAt ?? Date.now(),
        examAt:
          stored?.examAt ??
          (Number(data.hoursUntil) > 0
            ? Date.now() + Number(data.hoursUntil) * 60 * 60 * 1000
            : null)
      })
    );
  }, [
    aiAllocations,
    localAllocations,
    data.course,
    data.level,
    data.hoursUntil,
    data.hoursAvailable,
    data.topics,
    hoursUntilNumber,
    stored
  ]);

  useEffect(() => {
    const rawPlan = sessionStorage.getItem("cramifyAiPlan");
    if (!rawPlan) return;
    try {
      const parsed = JSON.parse(rawPlan);
      if (!parsed?.allocations || !data.topics.length) return;
      setAiAllocations(parsed.allocations);
      setAiStatus("idle");
      setAiError("");
    } catch {
      // ignore parse errors
    }
  }, [data.topics.length]);

  const continueToLearn = () => {
    persistTopicMeta(topicMeta);
    sessionStorage.setItem(
      "cramifyAiPlan",
      JSON.stringify({
        course: data.course,
        level: data.level,
        hoursUntil: hoursUntilNumber.toFixed(1),
        hoursAvailable: data.hoursAvailable,
        topics: data.topics,
        allocations: aiAllocations || localAllocations,
        createdAt: stored?.createdAt ?? Date.now(),
        examAt:
          stored?.examAt ??
          (Number(data.hoursUntil) > 0
            ? Date.now() + Number(data.hoursUntil) * 60 * 60 * 1000
            : null)
      })
    );
    router.push("/learn");
  };

  return (
    <main className="container">
      <header className="header">
        <div>
          <h1>Roadmap</h1>
          <p className="subtitle">A focused path based on your inputs.</p>
        </div>
        <div className="row">
          {hasExamBank && (
            <Link className="ghost" href="/exam-practice">
              Generate exam MCQs
            </Link>
          )}
          <Link className="ghost" href="/">
            Back
          </Link>
        </div>
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
            <strong>{hoursUntilDisplay !== "—" ? hoursUntilDisplay : "—"}</strong>
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
          <button type="button" className="ghost" onClick={resetTopicMeta}>
            Reset sliders
          </button>
          <button type="button" className="ghost" onClick={continueToLearn}>
            Continue to learning plan
          </button>
          {aiStatus === "error" && (
            <span className="muted">
              AI unavailable.
              {aiError ? ` ${aiError}` : " Using local estimates."}
            </span>
          )}
          {aiClearedNotice && (
            <span className="muted">AI recommendation cleared due to edits.</span>
          )}
          {aiStatus === "ready" && aiLoadedFromAction && (
            <span className="muted">AI recommendations loaded.</span>
          )}
        </div>
        {data.topics.length === 0 ? (
          <p className="muted">
            No topics provided yet. Go back and add your topics to see a roadmap.
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

