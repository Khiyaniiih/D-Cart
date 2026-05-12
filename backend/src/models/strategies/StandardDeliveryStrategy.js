import { DeliveryStrategy } from "./DeliveryStrategy.js";

export class StandardDeliveryStrategy extends DeliveryStrategy {
  constructor() {
    super("STANDARD");
  }

  createDeliveryRecord({ orderId, address }) {
    const estimatedAt = new Date();
    estimatedAt.setDate(estimatedAt.getDate() + 1);

    return {
      orderId,
      address,
      status: "SCHEDULED",
      type: this.type,
      estimatedAt
    };
  }
}
