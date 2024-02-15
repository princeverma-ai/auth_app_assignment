import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User, IUser } from "./../models/user";
import catchAsync from "../utils/catchAsync";
import AppError from "../utils/AppError";
import sendEmail from "../utils/email";
import { APIFeatures, QueryString } from "../utils/ApiFeatures";

// Cookie options
const cookieExpiresIn: number = parseInt(
  process.env.COOKIE_EXPIRES_IN as string
);
const cookieOptions = {
  expires: new Date(Date.now() + cookieExpiresIn * 24 * 60 * 60 * 1000),
  httpOnly: true,
  secure: true,
};

// Function to sign the JWT token
const jwtSecret: string = process.env.JWT_SECRET as string;
const jwtExpiresIn: string = process.env.JWT_EXPIRES_IN as string;
const signToken = (userId: string) => {
  return jwt.sign({ userId }, jwtSecret, { expiresIn: jwtExpiresIn });
};

// Function to handle user login
export const login = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body;

    // Check if the user exists
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Check if the password is correct
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return next(new AppError("Invalid password", 401));
    }

    // Generate JWT token
    const token = signToken(user._id);

    // Set the token as a cookie
    res.cookie("token", token, cookieOptions);

    // Return success response
    res.status(200).json({ message: "Login successful", token });
  }
);

// Function to handle user signup
export const signup = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { name, email, password, role } = req.body;

    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError("User already exists", 400));
    }

    // Create a new user
    const newUser = new User({ name, email, password, role });
    await newUser.save();

    // Return success response
    res.status(201).json({ message: "Signup successful" });
  }
);

// AuthRequest interface
interface AuthRequest extends Request {
  user?: IUser;
}

// Function to handle protected route
export const protect = catchAsync(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    // Check if the user is logged in
    const token = req.cookies.token;
    if (!token) {
      return next(new AppError("You are not logged in", 401));
    }

    // Verify the JWT token
    const decodedToken = jwt.verify(token, jwtSecret) as {
      userId: string;
      iat: number;
    };
    const userId = decodedToken.userId;

    // Check if the user exists
    const user = await User.findById(userId);
    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Check if the user changed the password after the token was issued
    if (user.changedPasswordAfter(decodedToken.iat)) {
      return next(new AppError("User recently changed password", 401));
    }

    // Attach the user object to the request
    req.user = user;

    // Continue to the next middleware
    next();
  }
);

// Function to get the current user
export const getCurrentUser = catchAsync(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    // Return the user object
    res.status(200).json({ user: req.user });
  }
);

// Function to handle user logout
export const logout = (req: Request, res: Response) => {
  // Clear the token cookie
  res.clearCookie("token");

  // Return success response
  res.status(200).json({ message: "Logout successful" });
};

// Function to restrict routes by role
export const restrictTo = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // Check if the user's role is allowed
    if (req.user && !roles.includes(req.user.role)) {
      return next(new AppError("You do not have permission", 403));
    }

    // Continue to the next middleware
    next();
  };
};

// Function for forgot password
export const forgotPassword = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { email } = req.body;

    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Generate the reset token
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    const frontendForgotPassUrl: string = process.env
      .FRONTEND_FORGOT_PASS_URL as string;

    // Send the reset token to the user's email
    const resetURL = `${frontendForgotPassUrl}/${resetToken}`;

    // Send the reset token to the user's email
    const message = `Forgot your password? Open this link to reset your password: ${resetURL}.`;
    await sendEmail({
      to: user.email,
      subject: "Password Reset Token",
      text: message,
    });

    // Return success response
    res
      .status(200)
      .json({ message: "Token sent to email", token_for_test: resetToken });
  }
);

// Function for reset password
export const resetPassword = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const resetToken = req.params.token;
    const { password } = req.body;

    // Hash the reset token
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Find the user by reset token
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });
    if (!user) {
      return next(new AppError("Token is invalid or has expired", 400));
    }

    // Update the user's password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // Return success response
    res.status(200).json({ message: "Password reset successful" });
  }
);

// Function to update the password
export const updatePassword = catchAsync(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { currentPassword, newPassword } = req.body;

    // Check if the current password is correct
    const user = await User.findById(req.user?._id).select("+password");
    if (!user) {
      return next(new AppError("User not found", 404));
    }

    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return next(new AppError("Invalid password", 401));
    }

    // Update the password
    user.password = newPassword;
    await user.save();

    // Return success response
    res.status(200).json({ message: "Password update successful" });
  }
);

// Function to get all users
export const getAllUsers = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    // Fetch all users from the database
    const features = new APIFeatures(User.find(), req.query as QueryString) // Cast req.query to QueryString type

      .filter()
      .sort()
      .limitFields()
      .paginate();

    const users = await features.query;

    // Return the users
    res.status(200).json({ users });
  }
);

// Function to get a single user
export const getUser = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.params.id;

    // Find the user by id
    const user = await User.findById(userId);

    // Check if the user exists
    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Return the user
    res.status(200).json({ user });
  }
);

// Function to update a user
export const updateUser = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    // Check if the user is trying to update the password
    if (req.body.password) {
      return next(new AppError("This route is not for password updates", 400));
    }

    const userId = req.params.id;
    const { name, email } = req.body;

    // Find the user by id and update the details
    const user = await User.findByIdAndUpdate(
      userId,
      { name, email },
      { new: true }
    );

    // Check if the user exists
    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Return the updated user
    res.status(200).json({ user });
  }
);

// Function to delete a user
export const deleteUser = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.params.id;

    // Find the user by id and delete it
    const user = await User.findByIdAndUpdate(
      userId,
      { isDeleted: true },
      { new: true }
    );

    // Check if the user exists
    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Return the deleted user
    res.status(200).json({ user });
  }
);
