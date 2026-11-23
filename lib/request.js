function readJsonBody(req) {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      const error = new Error("Request body must be valid JSON.");
      error.statusCode = 400;
      throw error;
    }
  }
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) return req.body;
  const error = new Error("Request body must be a JSON object.");
  error.statusCode = 400;
  throw error;
}

module.exports = { readJsonBody };
