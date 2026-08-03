class ApiError extends Error {
  constructor(
    statusCode,
    message = "Something went wrong",
    errors = []
  ) {
    super(message);

    this.success = false;
    this.statusCode = statusCode;
    this.message = message;
    this.errors = errors;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }
}

export default ApiError;
