import { useCallback, useEffect, useState } from "react";
import { pickerApi } from "../api/pickerApi";
import { productApi } from "../api/productApi";
import { LoadingState } from "../components/common/LoadingState";
import { StatusBadge } from "../components/common/StatusBadge";
import { EmptyState } from "../components/common/EmptyState";
import { useOrderRealtime } from "../hooks/useOrderRealtime";
import { currency, formatDateTime } from "../utils/format";

export function PickerDashboardPage() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [liveMessage, setLiveMessage] = useState("");
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [substituteForm, setSubstituteForm] = useState({
    orderId: null,
    itemId: null,
    substituteProductId: "",
    note: ""
  });

  const loadData = useCallback(async () => {
    try {
      const [orderData, productResult] = await Promise.all([
        pickerApi.getOrders(),
        productApi.list()
      ]);
      setOrders(orderData);
      setProducts(productResult.products);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load picker dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const { isConnected } = useOrderRealtime(
    useCallback(
      async (event) => {
        setLiveMessage(`Order #${event.orderId} changed: ${event.type.replaceAll("_", " ")}.`);
        await loadData();
      },
      [loadData]
    )
  );

  const handleClaim = async (orderId) => {
    setError("");
    setSuccess("");
    try {
      await pickerApi.claimOrder(orderId);
      setSuccess(`Order #${orderId} claimed successfully.`);
      await loadData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to claim order.");
    }
  };

  const handleSubstitute = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    try {
      await pickerApi.substituteItem(
        substituteForm.orderId,
        substituteForm.itemId,
        {
          substituteProductId: Number(substituteForm.substituteProductId),
          note: substituteForm.note
        }
      );
      setSuccess("Item substituted successfully. Order total recalculated.");
      setSubstituteForm({ orderId: null, itemId: null, substituteProductId: "", note: "" });
      await loadData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to substitute item.");
    }
  };

  if (loading) {
    return <LoadingState label="Loading picker dashboard..." />;
  }

  if (orders.length === 0) {
    return (
      <EmptyState
        title="No orders to pick"
        description="There are no confirmed or assigned orders at this time."
      />
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 rounded-lg bg-white/70 px-6 py-6 backdrop-blur-sm lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-600">
            Picker
          </p>
          <h2 className="mt-2 text-3xl font-bold text-ink">Order fulfillment</h2>
          <p className="mt-1 text-sm text-slate-500">
            Claim orders, pick items, and manage substitutions.
          </p>
        </div>
        <div className="flex gap-3">
          <div className="panel px-4 py-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Unclaimed</p>
            <p className="mt-1 text-2xl font-bold text-amber-600">
              {orders.filter((o) => !o.pickerId).length}
            </p>
          </div>
          <div className="panel px-4 py-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">My Orders</p>
            <p className="mt-1 text-2xl font-bold text-brand-600">
              {orders.filter((o) => o.pickerId).length}
            </p>
          </div>
        </div>
      </div>

      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
      {success ? <p className="text-sm font-medium text-emerald-600">{success}</p> : null}
      <p className="text-sm text-slate-500">
        Live picker updates are {isConnected ? "connected" : "connecting"}.
        {liveMessage ? ` ${liveMessage}` : ""}
      </p>

      <div className="space-y-4">
        {orders.map((order) => (
          <div key={order.id} className="panel px-6 py-5">
            {/* Order Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <p className="text-lg font-bold text-slate-900">Order #{order.id}</p>
                    <StatusBadge status={order.status} />
                    {!order.pickerId && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        Unclaimed
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {order.customer?.name} • {formatDateTime(order.createdAt)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {order.delivery?.address && (
                  <p className="text-xs text-slate-500 max-w-xs truncate" title={order.delivery.address}>
                    📍 {order.delivery.address}
                  </p>
                )}
                {!order.pickerId ? (
                  <button
                    type="button"
                    onClick={() => handleClaim(order.id)}
                    className="btn-primary px-4 py-2"
                  >
                    Claim order
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedOrder(expandedOrder === order.id ? null : order.id)
                    }
                    className="btn-secondary px-4 py-2"
                  >
                    {expandedOrder === order.id ? "Collapse" : "View items"}
                  </button>
                )}
              </div>
            </div>

            {/* Order Summary Bar */}
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <span className="text-slate-500">
                Items: <strong className="text-slate-800">{order.items?.length || 0}</strong>
              </span>
              <span className="text-slate-500">
                Subtotal: <strong className="text-slate-800">{currency(order.subtotal)}</strong>
              </span>
              {order.deliveryFee > 0 && (
                <span className="text-slate-500">
                  Delivery: <strong className="text-slate-800">{currency(order.deliveryFee)}</strong>
                </span>
              )}
              <span className="text-slate-500">
                Total: <strong className="text-brand-700">{currency(order.total)}</strong>
              </span>
              {order.deliverySlot && (
                <span className="text-slate-500">
                  🕐 {order.deliverySlot.startTime} – {order.deliverySlot.endTime}
                </span>
              )}
            </div>

            {/* Expanded Item List */}
            {expandedOrder === order.id && order.pickerId && (
              <div className="mt-5 border-t border-slate-100 pt-5 space-y-3">
                <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">
                  Pick list
                </h4>

                {order.items?.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 rounded-lg border border-slate-100 px-4 py-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">{item.product?.name}</p>
                      <p className="text-sm text-slate-500">
                        Qty: {item.quantity} × {currency(item.price)}
                      </p>
                      {item.substituteProduct && (
                        <p className="mt-1 text-xs font-medium text-amber-700">
                          ↳ Substituted with: {item.substituteProduct.name}
                          {item.substitutionNote && ` — ${item.substitutionNote}`}
                        </p>
                      )}
                    </div>

                    {!item.substituteProductId && (
                      <button
                        type="button"
                        onClick={() =>
                          setSubstituteForm({
                            orderId: order.id,
                            itemId: item.id,
                            substituteProductId: "",
                            note: ""
                          })
                        }
                        className="btn-secondary px-3 py-1.5 text-xs"
                      >
                        Substitute
                      </button>
                    )}
                  </div>
                ))}

                {/* Substitution Form */}
                {substituteForm.orderId === order.id && substituteForm.itemId && (
                  <form
                    onSubmit={handleSubstitute}
                    className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 space-y-3"
                  >
                    <p className="text-sm font-semibold text-amber-800">
                      Substitute item #{substituteForm.itemId}
                    </p>
                    <select
                      className="field"
                      value={substituteForm.substituteProductId}
                      onChange={(e) =>
                        setSubstituteForm((prev) => ({
                          ...prev,
                          substituteProductId: e.target.value
                        }))
                      }
                      required
                    >
                      <option value="">Select replacement product</option>
                      {products
                        .filter((p) => p.stock > 0)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} — {currency(p.price)} (Stock: {p.stock})
                          </option>
                        ))}
                    </select>
                    <input
                      className="field"
                      placeholder="Reason for substitution (optional)"
                      value={substituteForm.note}
                      onChange={(e) =>
                        setSubstituteForm((prev) => ({ ...prev, note: e.target.value }))
                      }
                    />
                    <div className="flex gap-2">
                      <button type="submit" className="btn-primary px-4 py-2 text-sm">
                        Confirm substitution
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSubstituteForm({
                            orderId: null,
                            itemId: null,
                            substituteProductId: "",
                            note: ""
                          })
                        }
                        className="btn-secondary px-4 py-2 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
