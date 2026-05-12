import { AuthService } from "../services/auth.service.js";

const authService = new AuthService();

export const register = async (req, res) => {
  const result = await authService.register(req.body);
  res.status(201).json(result);
};

export const login = async (req, res) => {
  const result = await authService.login(req.body);
  res.status(200).json(result);
};

export const getMe = async (req, res) => {
  const user = await authService.getCurrentUser(req.user.id);
  res.status(200).json({ user });
};

export const forgotPassword = async (req, res) => {
  const result = await authService.requestPasswordReset(req.body.email);
  res.status(200).json(result);
};

export const resetPassword = async (req, res) => {
  const result = await authService.resetPassword(req.body);
  res.status(200).json(result);
};
