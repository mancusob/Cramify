const QUESTIONS_SAMPLE = [
  "Define limits and explain continuity with an example.",
  "Compute d/dx of sin(x^2) and explain the chain rule.",
  "Solve the quadratic equation x^2 - 5x + 6 = 0.",
  "State and apply the product rule to differentiate x^2 * e^x.",
  "Explain the Fundamental Theorem of Calculus in your own words.",
  "Evaluate the integral of 3x^2 from 0 to 2.",
  "What is the difference between mean and median? Provide examples.",
  "Describe standard deviation and how to compute it.",
  "Solve a system of linear equations using elimination."
];

const STOP_WORDS = new Set([
  "the",
  "and",
  "or",
  "to",
  "of",
  "in",
  "a",
  "an",
  "is",
  "with",
  "for",
  "by",
  "on",
  "what",
  "how",
  "explain",
  "define",
  "describe",
  "compute",
  "apply",
  "state",
  "solve",
  "evaluate",
  "your",
  "own",
  "words",
  "from",
  "at",
  "into"
]);

const LEVEL_STAGES = [
  ["Baseline concepts", "Guided practice", "Mixed questions"],
  ["Core refresh", "Guided practice", "Mixed questions"],
  ["Targeted practice", "Mixed questions"],
  ["Exam simulation", "Mixed questions"]
];

const questionsInput = document.getElementById("questionsInput");
const fileInput = document.getElementById("fileInput");
const questionCount = document.getElementById("questionCount");
const loadSample = document.getElementById("loadSample");
const knowledgeLevel = document.getElementById("knowledgeLevel");
const studyHours = document.getElementById("studyHours");
const maxSubtopics = document.getElementById("maxSubtopics");
const generatePlan = document.getElementById("generatePlan");
const planOutput = document.getElementById("planOutput");
const status = document.getElementById("status");

function updateCount() {
  const questions = parseQuestions(questionsInput.value);
  questionCount.textContent = `${questions.length} questions`;
}

function parseQuestions(raw) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function tokenize(question) {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function extractSubtopics(questions, maxTopics) {
  const frequency = new Map();
  questions.forEach((question) => {
    const seen = new Set();
    tokenize(question).forEach((token) => {
      if (seen.has(token)) return;
      seen.add(token);
      frequency.set(token, (frequency.get(token) || 0) + 1);
    });
  });

  const ranked = [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTopics);

  const subtopics = ranked
    .map(([keyword, count]) => ({
      keyword,
      count,
      questions: questions.filter((q) =>
        q.toLowerCase().includes(keyword)
      )
    }))
    .filter((topic) => topic.questions.length > 0);

  if (subtopics.length === 0) {
    return [
      {
        keyword: "General review",
        count: questions.length,
        questions
      }
    ];
  }

  return subtopics;
}

function allocateMinutes(subtopics, totalMinutes) {
  const totalWeight = subtopics.reduce((sum, topic) => sum + topic.count, 0);
  let allocated = 0;

  return subtopics.map((topic, index) => {
    const isLast = index === subtopics.length - 1;
    const minutes = isLast
      ? Math.max(totalMinutes - allocated, 10)
      : Math.max(Math.round((topic.count / totalWeight) * totalMinutes), 10);

    allocated += minutes;
    return { ...topic, minutes };
  });
}

function buildCheckpoints(level) {
  return LEVEL_STAGES[Math.min(level, LEVEL_STAGES.length - 1)];
}

function buildPlan(questions, level, hours, maxTopics) {
  const totalMinutes = Math.max(Number(hours) * 60, 60);
  const subtopics = extractSubtopics(questions, maxTopics);
  const allocated = allocateMinutes(subtopics, totalMinutes);
  const checkpoints = buildCheckpoints(level);

  return {
    totalMinutes,
    checkpoints,
    subtopics: allocated.map((topic) => ({
      ...topic,
      checkpointPlan: checkpoints.map((label, index) => ({
        label,
        minutes: Math.max(Math.round(topic.minutes / checkpoints.length), 10),
        index
      }))
    }))
  };
}

function renderPlan(plan) {
  planOutput.innerHTML = "";

  const summary = document.createElement("div");
  summary.className = "plan-card";
  summary.innerHTML = `
    <h3>Plan summary</h3>
    <p class="muted">
      Total study time: <strong>${plan.totalMinutes} minutes</strong>
      across <strong>${plan.subtopics.length} subtopics</strong>.
    </p>
    <div>
      ${plan.checkpoints
        .map((checkpoint) => `<span class="tag">${checkpoint}</span>`)
        .join("")}
    </div>
  `;
  planOutput.appendChild(summary);

  plan.subtopics.forEach((topic) => {
    const card = document.createElement("div");
    card.className = "plan-card";

    const questionsPreview = topic.questions.slice(0, 3);
    card.innerHTML = `
      <h3>${topic.keyword}</h3>
      <p class="muted">${topic.minutes} minutes allocated</p>
      <div>
        ${topic.checkpointPlan
          .map(
            (checkpoint) =>
              `<span class="tag">${checkpoint.label}: ${checkpoint.minutes} min</span>`
          )
          .join("")}
      </div>
      <ul class="list">
        ${questionsPreview
          .map((question) => `<li>${question}</li>`)
          .join("")}
      </ul>
      <p class="muted">
        Checkpoint: answer these, then move to the next topic unless accuracy
        drops below 70%.
      </p>
    `;

    planOutput.appendChild(card);
  });
}

function setStatus(message) {
  status.textContent = message;
}

questionsInput.addEventListener("input", updateCount);

fileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    questionsInput.value = reader.result.trim();
    updateCount();
  };
  reader.readAsText(file);
});

loadSample.addEventListener("click", () => {
  questionsInput.value = QUESTIONS_SAMPLE.join("\n");
  updateCount();
});

generatePlan.addEventListener("click", () => {
  const questions = parseQuestions(questionsInput.value);
  if (questions.length < 3) {
    setStatus("Please add at least 3 questions to build a plan.");
    return;
  }

  const level = Number(knowledgeLevel.value);
  const hours = Number(studyHours.value || 0);
  const maxTopics = Number(maxSubtopics.value || 6);

  setStatus("Building plan...");
  const plan = buildPlan(questions, level, hours, maxTopics);
  renderPlan(plan);
  setStatus("Plan ready.");
});

updateCount();
