import { useCallback, useEffect, useState } from "react";
import { orderApi } from "../api/orderApi";
import { EmptyState } from "../components/common/EmptyState";
import { LoadingState } from "../components/common/LoadingState";
import { Pagination } from "../components/common/Pagination";
import { StatusBadge } from "../components/common/StatusBadge";
import { useOrderRealtime } from "../hooks/useOrderRealtime";
import { currency, formatDateTime } from "../utils/format";

const ORDERS_PER_PAGE = 10;

export function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [liveMessage, setLiveMessage] = useState("");
  const [cancellingId, setCancellingId] = useState(null);
  const [receiptLoadingId, setReceiptLoadingId] = useState(null);

  const loadOrders = useCallback(async (currentPage) => {
    try {
      const result = await orderApi.list({
        page: currentPage,
        limit: ORDERS_PER_PAGE
      });

      setOrders(result.orders);
      setPagination(result.pagination || null);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders(page);
  }, [page, loadOrders]);

  const { isConnected } = useOrderRealtime(
    useCallback(
      async (event) => {
        setLiveMessage(`Order #${event.orderId} was updated live.`);
        await loadOrders(page);
      },
      [loadOrders, page]
    )
  );

  const handlePageChange = (newPage) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm("Are you sure you want to cancel this order? This action cannot be undone.")) {
      return;
    }

    setCancellingId(orderId);
    setError("");

    try {
      await orderApi.cancel(orderId);
      await loadOrders(page);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to cancel this order.");
    } finally {
      setCancellingId(null);
    }
  };

  const handleDownloadReceipt = async (orderId) => {
    setReceiptLoadingId(orderId);
    setError("");

    try {
      const fileBlob = await orderApi.downloadReceipt(orderId);
      const fileUrl = URL.createObjectURL(fileBlob);
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = `dcart-order-${orderId}-receipt.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(fileUrl);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to download receipt.");
    } finally {
      setReceiptLoadingId(null);
    }
  };

  if (loading) {
    return <LoadingState label="Loading orders..." />;
  }

  const formatSlotLabel = (slot) => {
    if (!slot) return null;
    return `${slot.startTime} - ${slot.endTime}`;
  };

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-600">
          Order tracking
        </p>
        <h2 className="mt-2 text-3xl font-bold text-ink">Your grocery orders</h2>
      </div>

      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
      {liveMessage ? (
        <p className="text-sm font-medium text-brand-700">
          Live updates {isConnected ? "connected" : "reconnecting"}: {liveMessage}
        </p>
      ) : (
        <p className="text-sm text-slate-500">
          Live order tracking is {isConnected ? "connected" : "connecting"}.
        </p>
      )}

      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Once you place an order, you can track its progress here."
        />
      ) : (
        <>
          <div className="space-y-4">
            {orders.map((order) => (
              <article key={order.id} className="panel px-6 py-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-semibold text-ink">Order #{order.id}</h3>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{formatDateTime(order.createdAt)}</p>
                    <p className="mt-2 text-sm text-slate-500">
                      Payment: {order.paymentMethod === "GCASH" ? "GCash via PayMongo" : "Cash on Delivery"} · {order.paymentStatus}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-lg font-bold text-slate-900">{currency(order.total)}</p>
                    {order.status === "PENDING" && (
                      <button
                        type="button"
                        onClick={() => handleCancelOrder(order.id)}
                        disabled={cancellingId === order.id}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                      >
                        {cancellingId === order.id ? "Cancelling..." : "Cancel order"}
                      </button>
                    )}
                    {order.status === "DELIVERED" && (
                      <button
                        type="button"
                        onClick={() => handleDownloadReceipt(order.id)}
                        disabled={receiptLoadingId === order.id}
                        className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 disabled:opacity-50"
                      >
                        {receiptLoadingId === order.id ? "Preparing..." : "Download receipt"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="space-y-3">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-4 text-sm">
                        <div>
                          <span className="text-slate-700">
                            {item.product.name} x {item.quantity}
                          </span>
                          {item.substituteProductId && item.substituteProduct ? (
                            <div>
                              <span className="text-amber-600">
                                Substituted with: {item.substituteProduct.name}
                              </span>
                            </div>
                          ) : null}
                        </div>
                        <span className="font-semibold text-slate-900">
                          {currency(item.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg bg-slate-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                      Delivery
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-700">
                      {order.delivery?.address || "Awaiting delivery details"}
                    </p>
                    {order.delivery?.status ? (
                      <div className="mt-3">
                        <StatusBadge status={order.delivery.status} />
                      </div>
                    ) : null}
                    <OrderProgress status={order.status} />
                    {order.paidAt ? (
                      <p className="mt-3 text-xs text-slate-500">
                        Paid {formatDateTime(order.paidAt)}
                      </p>
                    ) : null}
                    {order.deliverySlot ? (
                      <p className="mt-3 text-sm font-medium text-slate-700">
                        Expected Delivery: {formatSlotLabel(order.deliverySlot)}
                      </p>
                    ) : null}
                    {order.delivery?.estimatedAt ? (
                      <p className="mt-3 text-xs text-slate-500">
                        ETA {formatDateTime(order.delivery.estimatedAt)}
                      </p>
                    ) : null}
                    <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-sm">
                      <div className="flex items-center justify-between text-slate-500">
                        <span>Subtotal</span>
                        <span>{currency(order.subtotal)}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500">
                        <span>Delivery Fee</span>
                        <span>{currency(order.deliveryFee)}</span>
                      </div>
                      <div className="flex items-center justify-between font-semibold text-slate-900">
                        <span>Total</span>
                        <span>{currency(order.total)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <Pagination pagination={pagination} onPageChange={handlePageChange} />
        </>
      )}
    </section>
  );
}

function OrderProgress({ status }) {
  const steps = ["PENDING", "CONFIRMED", "PACKING", "OUT_FOR_DELIVERY", "DELIVERED"];
  const currentIndex = steps.indexOf(status);
  const isCancelled = status === "CANCELLED";

  if (isCancelled) {
    return <p className="mt-3 text-xs font-medium text-rose-600">This order was cancelled.</p>;
  }

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        <span>Live progress</span>
        <span>{status.replaceAll("_", " ")}</span>
      </div>
      <div className="flex gap-2">
        {steps.map((step, index) => (
          <div
            key={step}
            className={`h-2 flex-1 rounded-full ${
              currentIndex >= index ? "bg-brand-500" : "bg-slate-200"
            }`}
            title={step.replaceAll("_", " ")}
          />
        ))}
      </div>
    </div>
  );
}
