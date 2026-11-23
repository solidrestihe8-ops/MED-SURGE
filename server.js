const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { answerMatches, topics, questions, shuffle } = require("./lib/quiz");

const PORT = Number(process.env.PORT) || 3000;
const quizzes = new Map();
const publicFiles = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/styles.css": ["styles.css", "text/css; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"]
};

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10_000) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && publicFiles[url.pathname]) {
    const [file, type] = publicFiles[url.pathname];
    fs.readFile(path.join(__dirname, file), (error, contents) => {
      if (error) {
        sendJson(res, 500, { error: "Unable to load the requested page." });
        return;
      }
      res.writeHead(200, { "Content-Type": type });
      res.end(contents);
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/info") {
    sendJson(res, 200, { total: questions.length, topics });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/quiz") {
    try {
      const { count, category } = await readJson(req);
      const amount = Number(count);
      if (!Number.isInteger(amount) || amount < 1 || amount > questions.length) {
        sendJson(res, 400, { error: `Choose between 1 and ${questions.length} questions.` });
        return;
      }
      if (category && !topics.includes(category)) {
        sendJson(res, 400, { error: "Choose a valid topic." });
        return;
      }
      const pool = category ? questions.filter((item) => item.category === category) : questions;
      if (amount > pool.length) {
        sendJson(res, 400, { error: `This topic has ${pool.length} questions. Choose a smaller test.` });
        return;
      }
      const selected = shuffle(pool).slice(0, amount).map((item) => {
        return { id: item.id, category: item.category, question: item.question };
      });
      const quizId = randomUUID();
      quizzes.set(quizId, {
        questions: new Map(selected.map((item) => [item.id, pool.find((entry) => entry.id === item.id)])),
        answers: new Map()
      });
      sendJson(res, 201, { quizId, questions: selected });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/answer") {
    try {
      const { quizId, questionId, answer } = await readJson(req);
      const quiz = quizzes.get(quizId);
      if (!quiz) {
        sendJson(res, 404, { error: "Quiz not found. Start a new test." });
        return;
      }
      const item = quiz.questions.get(questionId);
      if (!item) {
        sendJson(res, 404, { error: "Question not found in this test." });
        return;
      }
      if (quiz.answers.has(questionId)) {
        sendJson(res, 409, { error: "This question has already been answered." });
        return;
      }
      if (typeof answer !== "string" || answer.trim().length === 0 || answer.length > 400) {
        sendJson(res, 400, { error: "Type an answer of up to 400 characters before continuing." });
        return;
      }
      const correct = answerMatches(answer, item.answer, item.acceptedAnswers);
      quiz.answers.set(questionId, correct);
      sendJson(res, 200, {
        correct,
        correctAnswer: item.answer,
        explanation: item.explanation,
        source: item.source,
        score: [...quiz.answers.values()].filter(Boolean).length,
        answered: quiz.answers.size,
        total: quiz.questions.size
      });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  sendJson(res, 404, { error: "Not found." });
});

server.listen(PORT, () => {
  console.log(`MED SURGE CBT is running at http://localhost:${PORT}`);
  console.log(`${questions.length} questions available across ${topics.length} topics.`);
});
