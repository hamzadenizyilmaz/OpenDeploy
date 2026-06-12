const { fail } = require("../utils/response");

function issueToMessage(issue) {
  const field = issue.path && issue.path.length ? issue.path.join(".") : "request";
  return `${field}: ${issue.message}`;
}

function validate(schema, source = "body") {
  return function validationMiddleware(req, res, next) {
    const result = schema.safeParse(req[source] || {});
    if (!result.success) {
      const flattened = result.error.flatten();
      const firstIssue = result.error.issues[0];
      const readable = firstIssue ? issueToMessage(firstIssue) : "Validation failed";
      return fail(res, 422, readable, "VALIDATION_FAILED", {
        ...flattened,
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
          code: issue.code
        }))
      });
    }
    req[source] = result.data;
    next();
  };
}

module.exports = { validate };
