import { GeofencingService } from "../services/geofencing.service.js";

const geofencingService = new GeofencingService();

export const validateLocation = async (req, res) => {
  const { latitude, longitude, accuracyMeters } = req.body;
  const result = await geofencingService.validateLocation(latitude, longitude, accuracyMeters);
  res.json(result);
};

export const getStoreZone = async (_req, res) => {
  const zone = await geofencingService.getStoreZone();
  res.json(zone);
};
