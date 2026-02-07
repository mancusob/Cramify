"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [step, setStep] = useState(0);
  const [courseName, setCourseName] = useState("");
  const [knowledgeLevel, setKnowledgeLevel] = useState("0");
  const [hoursUntilExam, setHoursUntilExam] = useState("");
  const [hoursAvailable, setHoursAvailable] = useState("");
  const [maxSubtopics, setMaxSubtopics] = useState("6");
  const [topics, setTopics] = useState("");
  const router = useRouter();

  const hoursUntilNumber = Number(hoursUntilExam || 0);
  const sleepHours = Math.ceil(hoursUntilNumber / 24) * 8;
  const bufferHours = 2;
  const recommendedStudyHours = Math.max(
    hoursUntilNumber - sleepHours - bufferHours,
    1
  );

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
              />
            </label>
          </div>
          <div className="row">
            <button
              type="button"
              className="primary"
              onClick={() => setStep(2)}
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
              <span>Hours available to study</span>
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
                sleep ~{sleepHours} hours and keep a small buffer.
              </p>
            ) : (
              <p className="muted">
                Enter your hours-until-exam to see a suggested study time.
              </p>
            )}
          </div>
          <div className="pop-card pop-in">
            <h2>Set your scope</h2>
            <p className="muted">
              What’s the max number of subtopics you want to cover? List the
              topics you need to study.
            </p>
            <div className="grid">
              <label className="field">
                <span>Max subtopics to cover</span>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={maxSubtopics}
                  onChange={(event) => setMaxSubtopics(event.target.value)}
                />
              </label>
            </div>
            <label className="field">
              <span>Topics to cover</span>
              <textarea
                rows="6"
                placeholder="e.g. KCL/KVL, Thevenin/Norton, RC transients, AC steady-state..."
                value={topics}
                onChange={(event) => setTopics(event.target.value)}
              />
            </label>
            <div className="row">
              <button
                type="button"
                className="primary"
                onClick={() =>
                  router.push(
                    `/roadmap?course=${encodeURIComponent(courseName)}&level=${encodeURIComponent(
                      knowledgeLevel
                    )}&hoursUntil=${encodeURIComponent(
                      hoursUntilExam
                    )}&hoursAvailable=${encodeURIComponent(
                      hoursAvailable
                    )}&maxSubtopics=${encodeURIComponent(
                      maxSubtopics
                    )}&topics=${encodeURIComponent(topics)}`
                  )
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
