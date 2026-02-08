"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [step, setStep] = useState(0);
  const [courseName, setCourseName] = useState("");
  const [knowledgeLevel, setKnowledgeLevel] = useState("0");
  const [hoursUntilExam, setHoursUntilExam] = useState("");
  const [hoursAvailable, setHoursAvailable] = useState("");
  const [topics, setTopics] = useState([]);
  const [topicInput, setTopicInput] = useState("");
  const router = useRouter();

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

  return (
    <main className="container">
      <header className="header">
        <div>
          <h1>Cramify</h1>
          <p className="subtitle">Build a custom cram plan in minutes.</p>
        </div>
        <button type="button" className="ghost">
          Start demo
        </button>
      </header>

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
