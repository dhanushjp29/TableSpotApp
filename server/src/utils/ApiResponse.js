class ApiResponse {
  constructor(
    statusCode,
    message = "Success",
    data = null,
    meta = null,
    success = true
  ) {
    this.success = success;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;

    if (meta) {
      this.meta = meta;
    }

    this.timestamp = new Date().toISOString();
  }
}

export default ApiResponse;
