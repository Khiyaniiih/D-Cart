import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { Admin } from "../models/Admin.js";
import { Customer } from "../models/Customer.js";
import { Staff } from "../models/Staff.js";
import { ROLES } from "../constants/roles.js";
import { AppError } from "../utils/AppError.js";
import { generateToken } from "../utils/jwt.js";
import { comparePassword, hashPassword } from "../utils/password.js";
import { EmailService } from "./email.service.js";
import { createHash, randomBytes } from "node:crypto";

const emailService = new EmailService();

export class AuthService {
  buildUserEntity(user) {
    if (user.role === ROLES.ADMIN) return new Admin(user);
    if (user.role === ROLES.STAFF) return new Staff(user);
    return new Customer(user);
  }

  async register(payload) {
    const existingUser = await prisma.user.findUnique({
      where: { email: payload.email }
    });

    if (existingUser) {
      throw new AppError("Email is already registered.", 409);
    }

    const hashedPassword = await hashPassword(payload.password);

    const user = await prisma.user.create({
      data: {
        name: payload.name,
        email: payload.email,
        password: hashedPassword,
        role: ROLES.CUSTOMER,
        cart: {
          create: {}
        }
      }
    });

    const entity = this.buildUserEntity(user);
    const token = generateToken({ sub: user.id, role: user.role });

    return {
      token,
      user: entity.getProfile()
    };
  }

  async login(payload) {
    const user = await prisma.user.findUnique({
      where: { email: payload.email }
    });

    if (!user) {
      throw new AppError("Invalid email or password.", 401);
    }

    const isValidPassword = await comparePassword(payload.password, user.password);

    if (!isValidPassword) {
      throw new AppError("Invalid email or password.", 401);
    }

    const entity = this.buildUserEntity(user);
    const token = generateToken({ sub: user.id, role: user.role });

    return {
      token,
      user: entity.getProfile()
    };
  }

  async getCurrentUser(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new AppError("User not found.", 404);
    }

    return this.buildUserEntity(user).getProfile();
  }

  hashResetToken(token) {
    return createHash("sha256").update(token).digest("hex");
  }

  async requestPasswordReset(email) {
    const genericResponse = {
      message: "If that email is registered, a password reset link has been sent."
    };

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return genericResponse;
    }

    const rawToken = randomBytes(32).toString("hex");
    const hashedToken = this.hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + env.passwordResetTtlMinutes * 60 * 1000);
    const resetUrl = `${env.frontendUrl}/reset-password?token=${rawToken}`;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpiresAt: expiresAt
      }
    });

    const emailResult = await emailService.sendPasswordReset({
      to: user.email,
      name: user.name,
      resetUrl,
      expiresInMinutes: env.passwordResetTtlMinutes
    });

    return {
      ...genericResponse,
      ...(env.nodeEnv !== "production" && emailResult.preview
        ? { debugResetUrl: resetUrl, emailPreview: emailResult.preview }
        : {})
    };
  }

  async resetPassword({ token, password }) {
    const hashedToken = this.hashResetToken(token);

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpiresAt: {
          gt: new Date()
        }
      }
    });

    if (!user) {
      throw new AppError("This password reset link is invalid or has expired.", 400);
    }

    const hashedPassword = await hashPassword(password);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpiresAt: null
      }
    });

    return {
      message: "Password updated successfully. You can now sign in with your new password."
    };
  }
}
