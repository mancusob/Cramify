"use client";

import { useState } from "react";

export default function Home() {
  const [step, setStep] = useState(1);

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

      {step === 1 && (
        <section className="panel screen screen-in" key="step-1">
          <div className="row align-start">
            <div className="mascot" aria-hidden="true">
              🐿️
            </div>
            <div className="mascot-bubble">
              <p className="bubble-title">Hi! I’m Crammy.</p>
              <p className="muted">
                Let’s get started. What’s the course name for your exam?
              </p>
            </div>
          </div>
          <div className="grid">
            <label className="field">
              <span>Course name</span>
              <input type="text" placeholder="e.g. Circuits I (EE 201)" />
            </label>
            <label className="field">
              <span>Current knowledge level</span>
              <select>
                <option value="0">Starting from zero</option>
                <option value="1">Basic familiarity</option>
                <option value="2">Intermediate</option>
                <option value="3">Advanced / Review</option>
              </select>
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
            <span className="muted">Step 1 of 2</span>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="panel screen screen-in" key="step-2">
          <div className="row align-start">
            <div className="mascot" aria-hidden="true">
              🐿️
            </div>
            <div className="mascot-bubble">
              <p className="bubble-title">Nice. Let’s set your time.</p>
              <p className="muted">
                How many hours can you realistically study before the exam?
              </p>
            </div>
          </div>
          <div className="grid">
            <label className="field">
              <span>Hours until exam</span>
              <input type="number" min="1" placeholder="e.g. 48" />
            </label>
            <label className="field">
              <span>Hours available to study</span>
              <input type="number" min="1" placeholder="e.g. 10" />
            </label>
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
                <input type="number" min="1" max="12" defaultValue="6" />
              </label>
            </div>
            <label className="field">
              <span>Topics to cover</span>
              <textarea
                rows="6"
                placeholder="e.g. KCL/KVL, Thevenin/Norton, RC transients, AC steady-state..."
              />
            </label>
            <div className="row">
              <button type="button" className="primary">
                Continue
              </button>
              <span className="muted">Interface only — logic coming next.</span>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
