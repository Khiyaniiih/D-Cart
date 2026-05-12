import client from "./client";

export const adminApi = {
  dashboard: async () => {
    const { data } = await client.get("/admin/dashboard");
    return data.dashboard;
  },
  createStaff: async (payload) => {
    const { data } = await client.post("/admin/staff", payload);
    return data.staff;
  }
};
