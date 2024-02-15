import express, { Router } from "express";

import userRouter from "./routes/user";

// Create a new router instance
const router: Router = express.Router();

router.use("/user", userRouter);

// Export the router
export default router;
