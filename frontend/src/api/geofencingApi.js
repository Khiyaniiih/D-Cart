import client from "./client";

export const geofencingApi = {
  validateLocation: (latitude, longitude, accuracyMeters) =>
    client
      .post("/geofencing/validate", { latitude, longitude, accuracyMeters })
      .then((res) => res.data),

  getStoreZone: () =>
    client.get("/geofencing/store-zone").then((res) => res.data)
};
