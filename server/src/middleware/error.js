export function notFound(req, res, next) {
  const error = new Error("Not found");
  res.status(404);
  next(error);
}

export function errorHandler(error, req, res, next) {
  const uploadStatus = error.code === "LIMIT_FILE_SIZE" ? 400 : undefined;
  const status = error.statusCode || uploadStatus || (res.statusCode === 200 ? 500 : res.statusCode);
  const isProduction = process.env.NODE_ENV === "production";
  const message = error.code === "LIMIT_FILE_SIZE" ? "File is too large" : error.message;
  const publicMessage = status >= 500 && isProduction
    ? "Server error"
    : error.name === "CastError"
      ? "Invalid identifier"
      : message || "Server error";
  res.status(status).json({
    message: publicMessage,
    stack: isProduction ? undefined : error.stack
  });
}
