const { topics, questions } = require("../source-questions");

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function normalizeAnswer(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|a|an|is|are|was|were|of|and|to|in|on|by|for|from|with|it|they|their|its|this|that|which|your|you|does|do|can|help|helps)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stem(word) {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 5 && /(?:ches|shes|xes|zes|sses)$/.test(word)) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith("s")) return word.slice(0, -1);
  return word;
}

function answerMatches(response, expected, acceptedAnswers = []) {
  const normalizedResponse = normalizeAnswer(response);
  const normalizedExpected = normalizeAnswer(expected);
  const accepted = [normalizedExpected, ...acceptedAnswers.map(normalizeAnswer)];
  if (accepted.some((value) => normalizedResponse === value || normalizedResponse.includes(value))) return true;

  const expectedWords = [...new Set(normalizedExpected.split(" ").filter(Boolean).map(stem))];
  const responseWords = new Set(normalizedResponse.split(" ").filter(Boolean).map(stem));
  const matches = expectedWords.filter((word) => responseWords.has(word)).length;
  if (expectedWords.length > 1 && matches >= Math.ceil(expectedWords.length * 0.5)) return true;

  return acceptedAnswers.some((alias) => {
    const aliasWords = [...new Set(normalizeAnswer(alias).split(" ").filter(Boolean).map(stem))];
    const aliasMatches = aliasWords.filter((word) => responseWords.has(word)).length;
    return aliasWords.length > 1 && aliasMatches >= Math.ceil(aliasWords.length * 0.5);
  });
}

module.exports = { answerMatches, questions, shuffle, topics };
