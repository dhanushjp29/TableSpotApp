import ApiError from "../utils/ApiError.js";

const validateRequest = (schema, source = "body") => {
  return (req, _res, next) => {
    const data = req[source];

    const result = schema.safeParse(data);

    if (!result.success) {
      const issues = result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      const detail = issues
        .map((issue) =>
          issue.path ? `${issue.path}: ${issue.message}` : issue.message
        )
        .join("; ");
      return next(
        new ApiError(
          400,
          detail ? `Validation failed. ${detail}` : "Validation failed.",
          issues
        )
      );
    }

    req.validatedData = result.data;
    return next();
  };
};

export default validateRequest;
