import mongoose, { Schema, Document, Query } from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// Define the user schema
interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  passwordChangedAt?: Date;
  role: string;
  isDeleted: boolean;
  comparePassword: (password: string) => Promise<boolean>;
  changedPasswordAfter: (JWTTimestamp: number) => boolean;
  createPasswordResetToken: () => string;
}

const userSchema: Schema<IUser> = new Schema<IUser>({
  name: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: /^\S+@\S+\.\S+$/,
  },
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user",
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false,
  },
  passwordResetToken: String,
  passwordResetExpires: Date,
  passwordChangedAt: Date,
  isDeleted: {
    type: Boolean,
    default: false,
    select: false,
  },
});

// Hash the password before saving
userSchema.pre<IUser>("save", async function (next) {
  if (this.isModified("password")) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

// Add a method to update passwordChangedAt property
userSchema.pre<IUser>("save", function (next) {
  if (this.isModified("password") && !this.isNew) {
    this.passwordChangedAt = new Date(Date.now() - 1000);
  }
  next();
});

// Query middleware
userSchema.pre(/^find/, function (this: Query<any, any>, next) {
  this.find({ isDeleted: { $ne: true } });
  next();
});

// Add a method to compare passwords
userSchema.methods.comparePassword = async function (
  password: string
): Promise<boolean> {
  return bcrypt.compare(password, this.password);
};

// Add a method to check if the password was changed after the token was issued
userSchema.methods.changedPasswordAfter = function (
  JWTTimestamp: number
): boolean {
  if (this.passwordChangedAt) {
    const changedTimestamp = this.passwordChangedAt.getTime() / 1000;
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Add a method to create a password reset token
userSchema.methods.createPasswordResetToken = function (): string {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  return resetToken;
};

// Create the user model
const User = mongoose.model<IUser>("User", userSchema);

export { User, IUser };
