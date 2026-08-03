import ApiError from "../utils/ApiError.js";

const validateRequest = (schema, source = "body") => {
  return (req, _res, next) => {
    const data = req[source];

    const result = schema.safeParse(data);

    if (!result.success) {
      return next(
        new ApiError(
          400,
          "Validation failed.",
          result.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          }))
        )
      );
    }

    req.validatedData = result.data;
    return next();
  };
};

export default validateRequest;
