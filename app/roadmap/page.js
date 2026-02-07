import Link from "next/link";

const LEVEL_LABELS = {
  0: "Starting from zero",
  1: "Basic familiarity",
  2: "Intermediate",
  3: "Advanced / Review"
};

function parseTopics(raw) {
  if (!raw) return [];
  return raw
    .split(/[\n,]+/g)
    .map((topic) => topic.trim())
    .filter(Boolean);
}

export default function Roadmap({ searchParams }) {
  const course = searchParams?.course || "Your course";
  const level = searchParams?.level || "0";
  const hoursUntil = searchParams?.hoursUntil || "—";
  const hoursAvailable = searchParams?.hoursAvailable || "—";
  const maxSubtopics = searchParams?.maxSubtopics || "—";
  const topics = parseTopics(searchParams?.topics || "");

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
            <strong>{course}</strong>
          </div>
          <div className="info-card">
            <span className="info-label">Knowledge level</span>
            <strong>{LEVEL_LABELS[level] || LEVEL_LABELS[0]}</strong>
          </div>
          <div className="info-card">
            <span className="info-label">Hours until exam</span>
            <strong>{hoursUntil}</strong>
          </div>
          <div className="info-card">
            <span className="info-label">Hours available</span>
            <strong>{hoursAvailable}</strong>
          </div>
          <div className="info-card">
            <span className="info-label">Max subtopics</span>
            <strong>{maxSubtopics}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Topic Roadmap</h2>
        {topics.length === 0 ? (
          <p className="muted">
            No topics provided yet. Go back and add your topics to see a
            roadmap.
          </p>
        ) : (
          <div className="roadmap-grid">
            {topics.map((topic, index) => (
              <div key={`${topic}-${index}`} className="plan-card">
                <span className="tag">Topic {index + 1}</span>
                <h3>{topic}</h3>
                <p className="muted">
                  Focus block with checkpoints and quick practice.
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
