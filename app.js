const welcome = document.querySelector("#welcome");
const quizScreen = document.querySelector("#quiz");
const resultsScreen = document.querySelector("#results");
const topicSelect = document.querySelector("#topic-select");
const startButton = document.querySelector("#start-button");
const setupError = document.querySelector("#setup-error");
const countHint = document.querySelector("#count-hint");
const answerInput = document.querySelector("#answer-input");
const checkButton = document.querySelector("#check-button");
const nextButton = document.querySelector("#next-button");
const feedback = document.querySelector("#feedback");

let selectedCount = 25;
let quiz = null;
let currentIndex = 0;
let score = 0;

const questionCountLabel = (count) => `${count} question${count === 1 ? "" : "s"}`;

async function requestJson(url, payload) {
  const response = await fetch(url, {
    method: payload ? "POST" : "GET",
    headers: payload ? { "Content-Type": "application/json" } : {},
    body: payload ? JSON.stringify(payload) : undefined
  });
  let data;
  try {
    data = JSON.parse(await response.text());
  } catch {
    throw new Error("The server returned a webpage instead of JSON. Start the MED SURGE server with `npm start` and open its URL.");
  }
  if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

async function loadTestInfo() {
  try {
    const { total, topics } = await requestJson("/api/info");
    document.querySelector("#total-count").textContent = total;
    document.querySelector(".question-total").innerHTML = `<b>${total}</b> questions`;
    for (const topic of topics) {
      const option = document.createElement("option");
      option.value = topic;
      option.textContent = topic;
      topicSelect.append(option);
    }
  } catch (error) {
    setupError.textContent = error.message;
    setupError.hidden = false;
  }
}

function updateCountHint() {
  const topic = topicSelect.value;
  document.querySelectorAll(".length-option").forEach((button) => {
    button.disabled = Boolean(topic) && Number(button.dataset.count) > 25;
  });
  if (topic && selectedCount > 25) {
    selectedCount = 25;
    document.querySelectorAll(".length-option").forEach((button) => {
      button.classList.toggle("selected", Number(button.dataset.count) === selectedCount);
    });
  }
  const amount = selectedCount;
  countHint.textContent = `${topic ? `${topic} · ` : ""}${amount === 250 ? "The complete question bank" : `A ${amount}-question ${amount === 10 ? "quick" : amount === 25 ? "focused" : "deep dive"} practice session`}`;
}

document.querySelectorAll(".length-option").forEach((button) => {
  button.addEventListener("click", () => {
    selectedCount = Number(button.dataset.count);
    document.querySelectorAll(".length-option").forEach((item) => item.classList.toggle("selected", item === button));
    updateCountHint();
  });
});

topicSelect.addEventListener("change", updateCountHint);

async function startQuiz() {
  startButton.disabled = true;
  setupError.hidden = true;
  try {
    quiz = await requestJson("/api/quiz", { count: selectedCount, category: topicSelect.value || null });
    currentIndex = 0;
    score = 0;
    welcome.hidden = true;
    resultsScreen.hidden = true;
    quizScreen.hidden = false;
    renderQuestion();
  } catch (error) {
    setupError.textContent = error.message;
    setupError.hidden = false;
  } finally {
    startButton.disabled = false;
  }
}

function renderQuestion() {
  const question = quiz.questions[currentIndex];
  answerInput.value = "";
  answerInput.disabled = false;
  feedback.hidden = true;
  feedback.className = "feedback";
  checkButton.hidden = false;
  checkButton.disabled = true;
  nextButton.hidden = true;
  document.querySelector("#progress-current").textContent = String(currentIndex + 1).padStart(2, "0");
  document.querySelector("#progress-total").textContent = quiz.questions.length;
  document.querySelector("#progress-bar").style.width = `${(currentIndex / quiz.questions.length) * 100}%`;
  document.querySelector("#answered-label").textContent = `${currentIndex} answered`;
  document.querySelector("#question-number").textContent = `QUESTION ${String(currentIndex + 1).padStart(2, "0")}`;
  document.querySelector("#current-topic").textContent = question.category;
  document.querySelector("#question-category").textContent = question.category.toUpperCase();
  document.querySelector("#question-text").textContent = question.question;
  answerInput.focus();
}

async function submitAnswer() {
  const answer = answerInput.value.trim();
  if (!answer) return;
  checkButton.disabled = true;
  const question = quiz.questions[currentIndex];
  try {
    const result = await requestJson("/api/answer", {
      quizId: quiz.quizId,
      questionId: question.id,
      answer
    });
    score = result.score;
    feedback.className = `feedback ${result.correct ? "is-correct" : "is-incorrect"}`;
    const heading = document.createElement("strong");
    heading.textContent = result.correct
      ? `Correct! Your answer is on the right track. Model answer: ${result.correctAnswer}.`
      : `Not quite. The correct answer is: ${result.correctAnswer}.`;
    const explanation = document.createElement("span");
    explanation.textContent = `${result.explanation} Source: ${result.source}.`;
    feedback.replaceChildren(heading, explanation);
    feedback.hidden = false;
    answerInput.disabled = true;
    checkButton.hidden = true;
    nextButton.hidden = false;
    nextButton.focus();
    document.querySelector("#progress-bar").style.width = `${(result.answered / result.total) * 100}%`;
    document.querySelector("#answered-label").textContent = `${result.answered} answered`;
  } catch (error) {
    feedback.className = "feedback is-incorrect";
    feedback.textContent = error.message;
    feedback.hidden = false;
    checkButton.hidden = false;
    checkButton.disabled = false;
  }
}

function showResults() {
  quizScreen.hidden = true;
  resultsScreen.hidden = false;
  const total = quiz.questions.length;
  const percentage = Math.round((score / total) * 100);
  document.querySelector("#final-score").textContent = score;
  document.querySelector("#score-total").textContent = `/ ${total}`;
  document.querySelector("#result-summary").textContent = `You completed ${questionCountLabel(total)} across ${topicSelect.value || "all Med-Surg topics"}.`;
  document.querySelector("#score-message").textContent = percentage >= 80
    ? "Excellent work — your knowledge is really taking shape."
    : percentage >= 60
      ? "Nice effort! A little review will make the tricky bits stick."
      : "Every question is a chance to learn. Keep building on this.";
  document.querySelector(".score-ring").style.background = `conic-gradient(#5d8c66 ${percentage}%, #e7efe4 ${percentage}%)`;
  document.querySelector(".score-ring").style.border = "0";
}

answerInput.addEventListener("input", () => {
  checkButton.disabled = answerInput.value.trim().length === 0;
});
answerInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !checkButton.disabled && !checkButton.hidden) {
    event.preventDefault();
    submitAnswer();
  }
});
checkButton.addEventListener("click", submitAnswer);
nextButton.addEventListener("click", () => {
  if (currentIndex + 1 < quiz.questions.length) {
    currentIndex += 1;
    renderQuestion();
  } else {
    showResults();
  }
});
document.querySelector("#exit-button").addEventListener("click", () => {
  quizScreen.hidden = true;
  welcome.hidden = false;
});
document.querySelector("#home-button").addEventListener("click", () => {
  resultsScreen.hidden = true;
  welcome.hidden = false;
});
document.querySelector("#retry-button").addEventListener("click", startQuiz);
startButton.addEventListener("click", startQuiz);
loadTestInfo();
