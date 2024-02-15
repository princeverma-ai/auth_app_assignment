import express, { Router } from "express";
import {
  login,
  signup,
  logout,
  forgotPassword,
  resetPassword,
  updatePassword,
  protect,
  getCurrentUser,
  getAllUsers,
  getUser,
  updateUser,
  deleteUser,
  restrictTo,
} from "./../controllers/user";

// Create a new router instance
const userRouter: Router = express.Router();

// Auth routes
userRouter.route("/auth/signup").post(signup);
userRouter.route("/auth/login").post(login);
userRouter.route("/auth/logout").post(logout);
userRouter.route("/auth/forgotPassword").post(forgotPassword);
userRouter.route("/auth/resetPassword/:token").patch(resetPassword);
userRouter.route("/auth/updatePassword").patch(protect, updatePassword);

// CRUD routes - Protected
userRouter.use(protect);
userRouter.route("/").get(restrictTo("admin"), getAllUsers);
userRouter.route("/getMe").get(getCurrentUser);
userRouter.route("/:id").get(getUser).patch(updateUser).delete(deleteUser);

// Export the router
export default userRouter;
