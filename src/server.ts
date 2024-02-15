import dotenv from "dotenv";
import mongoose from "mongoose";

// Handle unhandled events
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

// Load environment variables from .env file
dotenv.config();

import app from "./app";

// Connect to the database
const DB_URI: string = process.env.DB_URI as string;
const PORT = process.env.PORT;

mongoose
  .connect(DB_URI)
  .then(() => {
    console.log("Connected to the database");
    // Start the server after successful database connection
    app.listen(PORT, () => {
      console.log(`Server is listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Database connection failed:", error);
  });

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection:", reason);
  process.exit(1);
});
