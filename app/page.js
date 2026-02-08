"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { extractTextFromPdfFile } from "../lib/pdfClient";

export default function Home() {
  const [step, setStep] = useState(-1);
  const [courseName, setCourseName] = useState("");
  const [knowledgeLevel, setKnowledgeLevel] = useState("0");
  const [hoursUntilExam, setHoursUntilExam] = useState("");
  const [hoursAvailable, setHoursAvailable] = useState("");
  const [topics, setTopics] = useState([]);
  const [topicInput, setTopicInput] = useState("");
  const [examQuestionsPdf, setExamQuestionsPdf] = useState(null);
  const [examAnswersPdf, setExamAnswersPdf] = useState(null);
  const [examStatus, setExamStatus] = useState("idle");
  const [examError, setExamError] = useState("");
  const [examReady, setExamReady] = useState(false);
  const router = useRouter();
  const welcomeTitle = "Cramify";
  const welcomeMessage =
    "A focused study companion for cramming exams under time pressure. Build a roadmap, track progress, and stay on pace to test day.";
  const [typedTitle, setTypedTitle] = useState("");
  const [typedMessage, setTypedMessage] = useState("");

  const hoursUntilNumber = Number(hoursUntilExam || 0);
  const sleepHours = Math.ceil(hoursUntilNumber / 24) * 8;
  const personalHours = Math.ceil(hoursUntilNumber / 24) * 1;
  const bufferHours = 1;
  const recommendedStudyHours = Math.max(
    hoursUntilNumber - sleepHours - personalHours - bufferHours,
    1
  );

  const addTopic = () => {
    const trimmed = topicInput.trim();
    if (!trimmed) return;
    if (topics.includes(trimmed)) {
      setTopicInput("");
      return;
    }
    setTopics((prev) => [...prev, trimmed]);
    setTopicInput("");
  };

  const removeTopic = (topicToRemove) => {
    setTopics((prev) => prev.filter((topic) => topic !== topicToRemove));
  };

  useEffect(() => {
    const raw = sessionStorage.getItem("cramifyExamBank");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.items)) {
        setExamReady(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const ingestExamPdfs = async () => {
    if (!examQuestionsPdf || !examAnswersPdf) return;
    setExamStatus("loading");
    setExamError("");
    setExamReady(false);
    try {
      const [questionsText, answersText] = await Promise.all([
        extractTextFromPdfFile(examQuestionsPdf),
        extractTextFromPdfFile(examAnswersPdf)
      ]);

      if (!questionsText.trim()) {
        throw new Error(
          "Could not extract text from the exam questions PDF (is it scanned images?)."
        );
      }
      if (!answersText.trim()) {
        throw new Error(
          "Could not extract text from the exam answers PDF (is it scanned images?)."
        );
      }

      const response = await fetch("/api/exam/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course: courseName || "Your course",
          level: knowledgeLevel || "0",
          topics,
          questionsText,
          answersText
        })
      });

      if (!response.ok) {
        const responseClone = response.clone();
        let errorMessage = "Exam ingest failed.";
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
      const bank = result?.bank;
      if (!bank || !Array.isArray(bank.items)) {
        throw new Error("Exam ingest returned an invalid bank.");
      }
      sessionStorage.setItem("cramifyExamBank", JSON.stringify(bank));
      setExamStatus("ready");
      setExamReady(true);
      setExamError("");
    } catch (error) {
      setExamStatus("error");
      setExamError(error?.message || "Exam ingest failed.");
      setExamReady(false);
    }
  };

  useEffect(() => {
    if (step !== -1) return;
    let titleIndex = 0;
    let messageIndex = 0;
    setTypedTitle("");
    setTypedMessage("");
    const interval = setInterval(() => {
      if (titleIndex < welcomeTitle.length) {
        titleIndex += 1;
        setTypedTitle(welcomeTitle.slice(0, titleIndex));
        return;
      }
      messageIndex += 1;
      setTypedMessage(welcomeMessage.slice(0, messageIndex));
      if (messageIndex >= welcomeMessage.length) {
        clearInterval(interval);
      }
    }, 15);
    return () => clearInterval(interval);
  }, [step, welcomeMessage, welcomeTitle]);

  return (
    <main className="container">
      {step !== -1 && (
        <header className="header">
          <div>
            <h1>Cramify</h1>
            <p className="subtitle">Build a custom cram plan in minutes.</p>
          </div>
        </header>
      )}

      {step === -1 && (
        <section className="panel screen screen-in pop-in" key="step-welcome">
          <div className="hero">
            <p className="eyebrow">Welcome</p>
            <h2 className="hero-title typing">{typedTitle}</h2>
            <p className="muted typing">{typedMessage}</p>
          </div>
          <div className="row">
            <button
              type="button"
              className="primary"
              onClick={() => setStep(0)}
            >
              Get started
            </button>
          </div>
        </section>
      )}

      {step === 0 && (
        <section className="panel screen screen-in" key="step-0">
          <div className="hero">
            <p className="eyebrow">Step 1</p>
            <h2 className="hero-title">What course are you studying for?</h2>
            <p className="muted">
              We’ll use this to personalize your cram plan.
            </p>
          </div>
          <div className="grid">
            <label className="field">
              <span>Course name</span>
              <input
                type="text"
                placeholder="e.g. Circuits I (EE 201)"
                value={courseName}
                onChange={(event) => setCourseName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    setStep(1);
                  }
                }}
              />
            </label>
          </div>
          <div className="row">
            <button
              type="button"
              className="primary"
              onClick={() => setStep(1)}
              disabled={!courseName.trim()}
            >
              Next
            </button>
            <span className="muted">Step 1 of 3</span>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="panel screen screen-in" key="step-1">
          <div className="hero">
            <p className="eyebrow">Step 2</p>
            <h2 className="hero-title">Set your baseline</h2>
            <p className="muted">
              Tell us your current knowledge level and timeline.
            </p>
          </div>
          <div className="grid">
            <label className="field">
              <span>Current knowledge level</span>
              <select
                value={knowledgeLevel}
                onChange={(event) => setKnowledgeLevel(event.target.value)}
              >
                <option value="0">Starting from zero</option>
                <option value="1">Basic familiarity</option>
                <option value="2">Intermediate</option>
                <option value="3">Advanced / Review</option>
              </select>
            </label>
            <label className="field">
              <span>Hours until exam</span>
              <input
                type="number"
                min="1"
                placeholder="e.g. 48"
                value={hoursUntilExam}
                onChange={(event) => setHoursUntilExam(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (Number(hoursUntilExam || 0) > 0) {
                      setStep(2);
                    }
                  }
                }}
              />
            </label>
          </div>
          <div className="row">
            <button
              type="button"
              className="primary"
              onClick={() => setStep(2)}
              disabled={Number(hoursUntilExam || 0) <= 0}
            >
              Next
            </button>
            <span className="muted">Step 2 of 3</span>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="panel screen screen-in" key="step-2">
          <div className="hero">
            <p className="eyebrow">Step 3</p>
            <h2 className="hero-title">Plan your scope</h2>
            <p className="muted">
              How many hours can you study, and which topics matter most?
            </p>
          </div>
          <div className="grid">
            <label className="field">
              <span>Amount of hours you plan to study</span>
              <input
                type="number"
                min="1"
                placeholder="e.g. 10"
                value={hoursAvailable}
                onChange={(event) => setHoursAvailable(event.target.value)}
              />
            </label>
          </div>
          <div className="helper">
            {hoursUntilNumber > 0 ? (
              <p className="muted">
                Recommended study time: about{" "}
                <strong>{recommendedStudyHours} hours</strong> so you can still
                sleep ~{sleepHours} hours, take ~{personalHours} hours for meals,
                and keep a small buffer.
              </p>
            ) : (
              <p className="muted">
                Enter your hours-until-exam to see a suggested study time.
              </p>
            )}
          </div>
          <div className="pop-card pop-in">
            <h2>Set your scope</h2>
            <p className="muted">List the topics you need to study.</p>
            <label className="field">
              <span>Add topics one by one</span>
              <div className="row">
                <input
                  type="text"
                  placeholder="e.g. KCL/KVL"
                  value={topicInput}
                  onChange={(event) => setTopicInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addTopic();
                    }
                  }}
                />
                <button
                  type="button"
                  className="ghost"
                  onClick={addTopic}
                >
                  Add
                </button>
              </div>
            </label>
            <div className="topic-list">
              {topics.length === 0 ? (
                <p className="muted">No topics added yet.</p>
              ) : (
                topics.map((topic) => (
                  <div key={topic} className="topic-item">
                    <span>{topic}</span>
                    <button
                      type="button"
                      className="ghost tiny"
                      onClick={() => removeTopic(topic)}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="stack" style={{ marginTop: "1rem" }}>
              <h2>Use your exam PDFs (optional)</h2>
              <p className="muted">
                Upload your exam questions PDF and answer/solutions PDF. We&apos;ll
                parse them and build a question bank (1 AI call) to generate
                exam-style practice questions later.
              </p>
              <div className="grid">
                <label className="field">
                  <span>Exam questions PDF</span>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(event) =>
                      setExamQuestionsPdf(event.target.files?.[0] || null)
                    }
                  />
                </label>
                <label className="field">
                  <span>Exam answers / solutions PDF</span>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(event) =>
                      setExamAnswersPdf(event.target.files?.[0] || null)
                    }
                  />
                </label>
              </div>
              <div className="row">
                <button
                  type="button"
                  className="primary"
                  onClick={ingestExamPdfs}
                  disabled={
                    examStatus === "loading" || !examQuestionsPdf || !examAnswersPdf
                  }
                >
                  {examStatus === "loading"
                    ? "Parsing PDFs..."
                    : "Build exam question bank"}
                </button>
                {examStatus === "error" && (
                  <span className="muted">Exam ingest failed. {examError}</span>
                )}
                {examReady && examStatus !== "loading" && (
                  <span className="muted">Exam bank ready for Learn.</span>
                )}
              </div>
            </div>

            <div className="row">
              <button
                type="button"
                className="primary"
                onClick={() =>
                  {
                    const createdAt = Date.now();
                    const examAt =
                      createdAt + Math.max(hoursUntilNumber, 0) * 60 * 60 * 1000;
                    const payload = {
                      course: courseName,
                      level: knowledgeLevel,
                      hoursUntil: hoursUntilExam,
                      hoursAvailable,
                      topics,
                      createdAt,
                      examAt
                    };
                    sessionStorage.setItem(
                      "cramifyRoadmap",
                      JSON.stringify(payload)
                    );
                    router.push(
                      `/roadmap?course=${encodeURIComponent(
                        courseName
                      )}&level=${encodeURIComponent(
                        knowledgeLevel
                      )}&hoursUntil=${encodeURIComponent(
                        hoursUntilExam
                      )}&hoursAvailable=${encodeURIComponent(
                        hoursAvailable
                      )}&topics=${encodeURIComponent(topics.join(", "))}`
                    );
                  }
                }
              >
                Continue
              </button>
              <span className="muted">Step 3 of 3</span>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
