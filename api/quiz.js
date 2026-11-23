const { randomUUID } = require("node:crypto");
const { questions, shuffle, topics } = require("../lib/quiz");
const { readJsonBody } = require("../lib/request");
const { QUIZ_TTL_SECONDS, quizStorageKey, redisCommand } = require("../lib/redis");

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const { count, category } = readJsonBody(req);
    const amount = Number(count);
    if (!Number.isInteger(amount) || amount < 1 || amount > questions.length) {
      return res.status(400).json({ error: `Choose between 1 and ${questions.length} questions.` });
    }
    if (category && !topics.includes(category)) {
      return res.status(400).json({ error: "Choose a valid topic." });
    }

    const pool = category ? questions.filter((item) => item.category === category) : questions;
    if (amount > pool.length) {
      return res.status(400).json({ error: `This topic has ${pool.length} questions. Choose a smaller test.` });
    }

    const selected = shuffle(pool).slice(0, amount).map(({ id, category: questionCategory, question }) => ({
      id,
      category: questionCategory,
      question
    }));
    const quizId = randomUUID();
    await redisCommand([
      "SET",
      quizStorageKey(quizId),
      JSON.stringify({ questionIds: selected.map((item) => item.id), answers: {} }),
      "EX",
      String(QUIZ_TTL_SECONDS)
    ]);

    return res.status(201).json({ quizId, questions: selected });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.statusCode ? error.message : "Unable to start a quiz. Please try again."
    });
  }
};
