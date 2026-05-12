import client from "./client";

export const orderApi = {
  checkout: async (payload) => {
    const { data } = await client.post("/orders/checkout", payload);
    return data.order;
  },
  list: async (params = {}) => {
    const { data } = await client.get("/orders", { params });
    return data;
  },
  cancel: async (id) => {
    const { data } = await client.patch(`/orders/${id}/cancel`);
    return data.order;
  },
  downloadReceipt: async (id) => {
    const response = await client.get(`/orders/${id}/receipt`, {
      responseType: "blob"
    });

    return response.data;
  },
  updateStatus: async (id, payload) => {
    const { data } = await client.patch(`/orders/${id}/status`, payload);
    return data.order;
  }
};
