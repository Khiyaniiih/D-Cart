export const notFoundHandler = (_req, res) => {
  res.status(404).json({
    message: "Resource not found."
  });
};

export const errorHandler = (error, _req, res, _next) => {
  const statusCode = error.statusCode || 500;
  const isProduction = process.env.NODE_ENV === "production";

  res.status(statusCode).json({
    message: error.message || "Internal server error.",
    details: isProduction ? null : (error.details || null),
    ...(!isProduction && { stack: error.stack })
  });
};
