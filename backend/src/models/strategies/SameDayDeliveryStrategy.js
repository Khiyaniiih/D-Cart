import { DeliveryStrategy } from "./DeliveryStrategy.js";

export class SameDayDeliveryStrategy extends DeliveryStrategy {
  constructor() {
    super("SAME_DAY");
  }

  createDeliveryRecord({ orderId, address }) {
    const estimatedAt = new Date();
    estimatedAt.setHours(estimatedAt.getHours() + 4);

    return {
      orderId,
      address,
      status: "SCHEDULED",
      type: this.type,
      estimatedAt
    };
  }
}
