const { answerMatches, questions } = require("../lib/quiz");
const { QUIZ_TTL_SECONDS, quizStorageKey, redisCommand } = require("../lib/redis");
const { readJsonBody } = require("../lib/request");

const recordAnswerScript = `
local raw = redis.call("GET", KEYS[1])
if not raw then return cjson.encode({ status = "quiz_not_found" }) end
local quiz = cjson.decode(raw)
local found = false
for _, id in ipairs(quiz.questionIds) do
  if id == ARGV[1] then found = true break end
end
if not found then return cjson.encode({ status = "question_not_found" }) end
if quiz.answers[ARGV[1]] ~= nil then return cjson.encode({ status = "already_answered" }) end
quiz.answers[ARGV[1]] = ARGV[2] == "true"
local score = 0
local answered = 0
for _, correct in pairs(quiz.answers) do
  answered = answered + 1
  if correct then score = score + 1 end
end
redis.call("SET", KEYS[1], cjson.encode(quiz), "EX", ARGV[3])
return cjson.encode({ status = "ok", score = score, answered = answered, total = #quiz.questionIds })
`;

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const { quizId, questionId, answer } = readJsonBody(req);
    if (typeof quizId !== "string" || typeof questionId !== "string") {
      return res.status(400).json({ error: "Quiz and question identifiers are required." });
    }
    if (typeof answer !== "string" || answer.trim().length === 0 || answer.length > 400) {
      return res.status(400).json({ error: "Type an answer of up to 400 characters before continuing." });
    }

    const item = questions.find((question) => question.id === questionId);
    if (!item) return res.status(404).json({ error: "Question not found in this test." });

    const correct = answerMatches(answer, item.answer, item.acceptedAnswers);
    const result = await redisCommand([
      "EVAL",
      recordAnswerScript,
      "1",
      quizStorageKey(quizId),
      questionId,
      String(correct),
      String(QUIZ_TTL_SECONDS)
    ]);
    const state = JSON.parse(result);

    if (state.status === "quiz_not_found") return res.status(404).json({ error: "Quiz not found. Start a new test." });
    if (state.status === "question_not_found") return res.status(404).json({ error: "Question not found in this test." });
    if (state.status === "already_answered") return res.status(409).json({ error: "This question has already been answered." });

    return res.status(200).json({
      correct,
      correctAnswer: item.answer,
      explanation: item.explanation,
      source: item.source,
      score: state.score,
      answered: state.answered,
      total: state.total
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.statusCode ? error.message : "Unable to check this answer. Please try again."
    });
  }
};
