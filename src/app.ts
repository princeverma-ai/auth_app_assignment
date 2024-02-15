import express, { Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import router from "./routes";

// Import AppError && errorHandler
import AppError from "./utils/AppError";
import errorHandler from "./utils/errorHandler";

// Create a new express application instance
const app = express();

// Set security HTTP headers
app.use(helmet());

// Middleware
app.use(
  express.json({
    limit: "10kb",
  })
);
app.use(cookieParser());

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Routes
app.use("/api", router);

// Invalid route handler
app.all("*", (req: Request, res: Response, next: NextFunction) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Error handler
app.use(errorHandler);

// Export the app
export default app;
