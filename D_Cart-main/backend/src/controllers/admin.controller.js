import { AdminService } from "../services/admin.service.js";

const adminService = new AdminService();

export const getDashboard = async (_req, res) => {
  const dashboard = await adminService.getDashboardMetrics();
  res.status(200).json({ dashboard });
};

export const createStaff = async (req, res) => {
  const staff = await adminService.createStaff(req.body);
  res.status(201).json({ staff });
};
