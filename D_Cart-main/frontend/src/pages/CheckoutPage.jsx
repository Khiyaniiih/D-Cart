import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cartApi } from "../api/cartApi";
import { deliverySlotApi } from "../api/deliverySlotApi";
import { geofencingApi } from "../api/geofencingApi";
import { orderApi } from "../api/orderApi";
import { EmptyState } from "../components/common/EmptyState";
import { LoadingState } from "../components/common/LoadingState";
import { currency } from "../utils/format";

export function CheckoutPage() {
  const navigate = useNavigate();
  const [cart, setCart] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [geoResult, setGeoResult] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [form, setForm] = useState({
    address: "",
    deliveryType: "SAME_DAY",
    paymentMethod: "COD",
    latitude: null,
    longitude: null,
    accuracyMeters: null,
    deliverySlotId: ""
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [cartData, slotData] = await Promise.all([
          cartApi.get(),
          deliverySlotApi.getAvailable().catch(() => [])
        ]);
        setCart(cartData);
        setSlots(slotData);
      } catch (requestError) {
        setError(requestError.response?.data?.message || "Unable to load checkout.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setGeoLoading(true);
    setError("");
    setGeoResult(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const accuracyMeters = position.coords.accuracy || null;

        setForm((current) => ({
          ...current,
          latitude,
          longitude,
          accuracyMeters
        }));

        try {
          const result = await geofencingApi.validateLocation(
            latitude,
            longitude,
            accuracyMeters
          );

          setGeoResult(result);

          if (result.decision === "OUTSIDE_RADIUS") {
            setError(
              `Your location is ${result.displayDistanceKm}km away. Delivery is only available within ${result.store.deliveryRadius}km of the store.`
            );
          } else if (result.decision === "UNCERTAIN") {
            setError(result.reason || "Your GPS fix is not accurate enough yet. Please try again.");
          }
        } catch (_geoError) {
          setError("Unable to verify your location. Please try again.");
          setGeoResult(null);
        } finally {
          setGeoLoading(false);
        }
      },
      () => {
        setError(
          "Unable to detect your location. Please ensure location access is enabled in your browser settings."
        );
        setGeoLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };

  const isLocationVerified = geoResult?.isWithinRadius === true;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const payload = {
        address: form.address,
        deliveryType: form.deliveryType,
        paymentMethod: form.paymentMethod,
        latitude: form.latitude,
        longitude: form.longitude,
        accuracyMeters: form.accuracyMeters ?? undefined,
        deliverySlotId: form.deliverySlotId ? Number(form.deliverySlotId) : undefined
      };

      const order = await orderApi.checkout(payload);

      if (order.paymentMethod === "GCASH" && order.paymentCheckoutUrl) {
        window.location.href = order.paymentCheckoutUrl;
        return;
      }

      setSuccess(`Order #${order.id} has been placed successfully!`);
      setTimeout(() => navigate("/orders"), 1200);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to place the order. Please verify your location and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingState label="Preparing checkout..." />;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <EmptyState
        title="Nothing to check out"
        description="Add items to your cart before placing an order."
      />
    );
  }

  const deliveryFee = geoResult?.isWithinRadius ? geoResult.deliveryFee : 0;
  const grandTotal = cart.subtotal + deliveryFee;

  const slotsByDate = slots.reduce((accumulator, slot) => {
    const dateKey = new Date(slot.date).toLocaleDateString("en-PH", {
      weekday: "short",
      month: "short",
      day: "numeric"
    });

    if (!accumulator[dateKey]) {
      accumulator[dateKey] = [];
    }

    accumulator[dateKey].push(slot);
    return accumulator;
  }, {});

  return (
    <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <form onSubmit={handleSubmit} className="panel px-6 py-6">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-600">
          Checkout
        </p>
        <h2 className="mt-2 text-2xl font-bold text-ink">Delivery details</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Please enter your delivery address and verify your location to continue.
        </p>

        <div className="mt-6 space-y-4">
          <textarea
            name="address"
            rows="3"
            placeholder="House number, street, barangay, city/municipality, province"
            value={form.address}
            onChange={(event) =>
              setForm((current) => ({ ...current, address: event.target.value }))
            }
            className="field resize-none"
            required
          />

          <div
            className={`rounded-lg border px-4 py-4 ${
              isLocationVerified
                ? "border-emerald-200 bg-emerald-50/50"
                : "border-amber-200 bg-amber-50/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">Location verification</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {isLocationVerified
                    ? "Your location has been verified"
                    : "You must verify your location to place an order"}
                </p>
              </div>
              <button
                type="button"
                onClick={detectLocation}
                disabled={geoLoading}
                className="btn-secondary px-3 py-2 text-sm"
              >
                {geoLoading ? "Detecting..." : isLocationVerified ? "Re-detect" : "Detect location"}
              </button>
            </div>

            {geoResult && geoResult.isWithinRadius ? (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                <p className="text-sm text-emerald-800">
                  You are <strong>{geoResult.displayDistanceKm}km</strong> from the store.
                  Delivery fee: <strong>{currency(geoResult.deliveryFee)}</strong>
                </p>
                {geoResult.accuracyMeters ? (
                  <p className="mt-1 text-xs text-emerald-700">
                    GPS accuracy: approximately {Math.round(geoResult.accuracyMeters)} meters
                  </p>
                ) : null}
              </div>
            ) : null}

            {geoResult && geoResult.decision === "OUTSIDE_RADIUS" ? (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                <p className="text-sm text-rose-800">
                  You are <strong>{geoResult.displayDistanceKm}km</strong> away outside the{" "}
                  {geoResult.store.deliveryRadius}km delivery zone.
                </p>
              </div>
            ) : null}

            {geoResult && geoResult.decision === "UNCERTAIN" ? (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-sm text-amber-800">
                  {geoResult.reason || "Your GPS reading is too imprecise for delivery validation."}
                </p>
                {geoResult.accuracyMeters ? (
                  <p className="mt-1 text-xs text-amber-700">
                    Reported accuracy: approximately {Math.round(geoResult.accuracyMeters)} meters
                  </p>
                ) : null}
              </div>
            ) : null}

            {!geoResult && !geoLoading ? (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-sm text-amber-800">
                  Click &quot;Detect location&quot; to verify you are within our delivery area.
                </p>
              </div>
            ) : null}
          </div>

          <select
            name="deliveryType"
            value={form.deliveryType}
            onChange={(event) =>
              setForm((current) => ({ ...current, deliveryType: event.target.value }))
            }
            className="field"
          >
            <option value="SAME_DAY">Same-day delivery</option>
            <option value="STANDARD">Standard delivery</option>
          </select>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700">Payment method</p>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-4 py-3">
              <input
                type="radio"
                name="paymentMethod"
                value="COD"
                checked={form.paymentMethod === "COD"}
                onChange={(event) =>
                  setForm((current) => ({ ...current, paymentMethod: event.target.value }))
                }
                className="mt-1"
              />
              <span>
                <span className="block font-semibold text-slate-800">Cash on Delivery</span>
                <span className="block text-sm text-slate-500">
                  Place the order immediately and pay when your groceries arrive.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-4 py-3">
              <input
                type="radio"
                name="paymentMethod"
                value="GCASH"
                checked={form.paymentMethod === "GCASH"}
                onChange={(event) =>
                  setForm((current) => ({ ...current, paymentMethod: event.target.value }))
                }
                className="mt-1"
              />
              <span>
                <span className="block font-semibold text-slate-800">GCash via PayMongo</span>
                <span className="block text-sm text-slate-500">
                  You&apos;ll be redirected to a secure hosted checkout page to complete payment.
                </span>
              </span>
            </label>
          </div>

          {Object.keys(slotsByDate).length > 0 ? (
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">
                Choose a delivery time slot (optional)
              </p>
              <select
                value={form.deliverySlotId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, deliverySlotId: event.target.value }))
                }
                className="field"
              >
                <option value="">No preference (earliest available)</option>
                {Object.entries(slotsByDate).map(([dateLabel, dateSlots]) => (
                  <optgroup key={dateLabel} label={dateLabel}>
                    {dateSlots.map((slot) => (
                      <option key={slot.id} value={slot.id}>
                        {slot.startTime} - {slot.endTime} ({slot.available} slots left)
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        {error ? <p className="mt-4 text-sm font-medium text-rose-600">{error}</p> : null}
        {success ? <p className="mt-4 text-sm font-medium text-emerald-600">{success}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting || !isLocationVerified}
          className="btn-primary mt-6 w-full"
        >
          {isSubmitting
            ? form.paymentMethod === "GCASH"
              ? "Redirecting to GCash..."
              : "Placing order..."
            : !isLocationVerified
              ? "Verify location to continue"
              : form.paymentMethod === "GCASH"
                ? "Continue to GCash"
                : "Place order"}
        </button>
      </form>

      <aside className="panel h-fit px-6 py-6">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-600">
          Order summary
        </p>
        <div className="mt-5 space-y-4">
          {cart.items.map((item) => (
            <div key={item.productId} className="flex items-center justify-between gap-4 text-sm">
              <div>
                <p className="font-semibold text-slate-800">{item.product.name}</p>
                <p className="text-slate-500">Qty {item.quantity}</p>
              </div>
              <span className="font-semibold text-slate-900">
                {currency(item.product.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-2 border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-semibold text-slate-800">{currency(cart.subtotal)}</span>
          </div>

          {deliveryFee > 0 ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">
                Delivery ({geoResult?.displayDistanceKm}km)
              </span>
              <span className="font-semibold text-slate-800">{currency(deliveryFee)}</span>
            </div>
          ) : null}

          <div className="flex items-center justify-between border-t border-slate-100 pt-2">
            <span className="text-sm font-semibold text-slate-600">Total</span>
            <span className="text-lg font-bold text-ink">{currency(grandTotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Payment</span>
            <span className="font-semibold text-slate-800">
              {form.paymentMethod === "GCASH" ? "GCash via PayMongo" : "Cash on Delivery"}
            </span>
          </div>
        </div>
      </aside>
    </section>
  );
}
