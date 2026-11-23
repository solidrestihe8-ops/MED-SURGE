const QUIZ_TTL_SECONDS = 60 * 60 * 24;
const QUIZ_KEY_PREFIX = "med-surge:quiz:";

function createStorageError(message, statusCode = 503) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function redisCommand(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw createStorageError(
      "Quiz storage is not configured. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel, then redeploy."
    );
  }
  try {
    if (new URL(url).protocol !== "https:") {
      throw createStorageError("Quiz storage must use an HTTPS REST URL.");
    }
  } catch (error) {
    if (error.statusCode) throw error;
    throw createStorageError("Quiz storage URL is invalid.");
  }

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(command)
    });
  } catch {
    throw createStorageError("Quiz storage could not be reached. Check the Redis URL and try again.");
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw createStorageError("Quiz storage returned an invalid response.");
  }

  if (!payload || typeof payload !== "object" || !response.ok || payload.error) {
    throw createStorageError("Quiz storage request failed. Check the Redis credentials and try again.");
  }
  return payload.result;
}

function quizStorageKey(quizId) {
  return `${QUIZ_KEY_PREFIX}${quizId}`;
}

module.exports = { QUIZ_TTL_SECONDS, quizStorageKey, redisCommand };
