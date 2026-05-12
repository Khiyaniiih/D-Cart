import { useCallback, useEffect, useState } from "react";
import { adminApi } from "../api/adminApi";
import { categoryApi } from "../api/categoryApi";
import { deliverySlotApi } from "../api/deliverySlotApi";
import { orderApi } from "../api/orderApi";
import { productApi } from "../api/productApi";
import { LoadingState } from "../components/common/LoadingState";
import { StatusBadge } from "../components/common/StatusBadge";
import { useOrderRealtime } from "../hooks/useOrderRealtime";
import { currency, formatDateTime } from "../utils/format";

const initialForm = {
  id: null,
  name: "",
  price: "",
  stock: "",
  categoryId: ""
};

const initialStaffForm = {
  name: "",
  email: "",
  phone: "",
  password: ""
};

const STANDARD_DELIVERY_SHIFTS = [
  { startTime: "08:00", endTime: "10:00", maxOrders: 5 },
  { startTime: "10:00", endTime: "12:00", maxOrders: 5 },
  { startTime: "13:00", endTime: "15:00", maxOrders: 5 },
  { startTime: "15:00", endTime: "17:00", maxOrders: 5 }
];

export function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [deliverySlots, setDeliverySlots] = useState([]);
  const [productForm, setProductForm] = useState(initialForm);
  const [staffForm, setStaffForm] = useState(initialStaffForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [liveMessage, setLiveMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [generatingSlots, setGeneratingSlots] = useState(false);
  const [slotDate, setSlotDate] = useState(() => new Date().toISOString().split("T")[0]);

  const loadData = useCallback(async () => {
    try {
      const [categoryData, dashboardData, productResult, orderResult, slotResult] = await Promise.all([
        categoryApi.list(),
        adminApi.dashboard(),
        productApi.list(),
        orderApi.list(),
        deliverySlotApi.adminGetAll()
      ]);

      setCategories(categoryData);
      setDashboard(dashboardData);
      setProducts(productResult.products);
      setOrders(orderResult.orders);
      setDeliverySlots(slotResult);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load admin dashboard.");
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

  const resetForm = () => setProductForm(initialForm);
  const resetStaffForm = () => setStaffForm(initialStaffForm);

  const handleProductSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccessMessage("");

    const payload = {
      name: productForm.name,
      price: Number(productForm.price),
      stock: Number(productForm.stock),
      categoryId: Number(productForm.categoryId)
    };

    try {
      if (productForm.id) {
        await productApi.update(productForm.id, payload);
      } else {
        await productApi.create(payload);
      }

      resetForm();
      await loadData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to save product.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm("Are you sure you want to delete this product? This action cannot be undone.")) {
      return;
    }

    setError("");
    setSuccessMessage("");

    try {
      await productApi.remove(productId);
      await loadData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to delete product.");
    }
  };

  const handleStatusChange = async (orderId, status) => {
    setError("");
    setSuccessMessage("");

    try {
      await orderApi.updateStatus(orderId, { status });
      await loadData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to update order status.");
    }
  };

  const handleStaffSubmit = async (event) => {
    event.preventDefault();
    setCreatingStaff(true);
    setError("");
    setSuccessMessage("");

    try {
      const staff = await adminApi.createStaff(staffForm);
      resetStaffForm();
      setSuccessMessage(`Staff account created for ${staff.name}.`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to create staff account.");
    } finally {
      setCreatingStaff(false);
    }
  };

  const handleGenerateSlots = async (event) => {
    event.preventDefault();
    setGeneratingSlots(true);
    setError("");
    setSuccessMessage("");

    try {
      await deliverySlotApi.generate(slotDate, STANDARD_DELIVERY_SHIFTS);
      setSuccessMessage(`Delivery slots generated for ${slotDate}.`);
      await loadData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to generate delivery slots.");
    } finally {
      setGeneratingSlots(false);
    }
  };

  if (loading) {
    return <LoadingState label="Loading admin dashboard..." />;
  }

  const upcomingSlots = deliverySlots.filter((slot) => new Date(slot.date) >= new Date());

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 rounded-lg bg-white/70 px-6 py-6 backdrop-blur-sm lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-600">
            Admin
          </p>
          <h2 className="mt-2 text-3xl font-bold text-ink">Operations dashboard</h2>
        </div>
      </div>

      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
      {successMessage ? <p className="text-sm font-medium text-emerald-600">{successMessage}</p> : null}
      <p className="text-sm text-slate-500">
        Operations live feed is {isConnected ? "connected" : "connecting"}.
        {liveMessage ? ` ${liveMessage}` : ""}
      </p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Orders" value={dashboard?.totals.orders || 0} />
        <MetricCard label="Delivered" value={dashboard?.totals.delivered || 0} />
        <MetricCard label="Products" value={dashboard?.totals.products || 0} />
        <MetricCard label="Pending" value={dashboard?.totals.pendingOrders || 0} />
        <MetricCard label="Sales" value={currency(dashboard?.totals.sales || 0)} />
        <MetricCard
          label="Low Stock"
          value={dashboard?.totals.lowStockAlerts || 0}
          valueClassName={dashboard?.totals.lowStockAlerts > 0 ? "text-rose-600" : "text-ink"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="panel px-6 py-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-600">
                Product form
              </p>
              <h3 className="mt-2 text-xl font-bold text-ink">
                {productForm.id ? "Update inventory item" : "Add inventory item"}
              </h3>
            </div>
            {productForm.id ? (
              <button type="button" onClick={resetForm} className="btn-secondary px-3 py-2">
                New item
              </button>
            ) : null}
          </div>

          <form onSubmit={handleProductSubmit} className="space-y-4">
            <input
              className="field"
              placeholder="Product name"
              value={productForm.name}
              onChange={(event) =>
                setProductForm((current) => ({ ...current, name: event.target.value }))
              }
              required
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                className="field"
                type="number"
                step="0.01"
                placeholder="Price"
                value={productForm.price}
                onChange={(event) =>
                  setProductForm((current) => ({ ...current, price: event.target.value }))
                }
                required
              />
              <input
                className="field"
                type="number"
                placeholder="Stock"
                value={productForm.stock}
                onChange={(event) =>
                  setProductForm((current) => ({ ...current, stock: event.target.value }))
                }
                required
              />
            </div>
            <select
              className="field"
              value={productForm.categoryId}
              onChange={(event) =>
                setProductForm((current) => ({ ...current, categoryId: event.target.value }))
              }
              required
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <button type="submit" disabled={saving} className="btn-primary w-full">
              {saving ? "Saving..." : productForm.id ? "Update product" : "Create product"}
            </button>
          </form>
        </div>

        <div className="panel px-6 py-6">
          <div className="mb-5">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-600">
              Inventory
            </p>
            <h3 className="mt-2 text-xl font-bold text-ink">Product catalog management</h3>
          </div>
          <div className="space-y-4">
            {products.map((product) => (
              <div
                key={product.id}
                className="flex flex-col gap-4 rounded-lg border border-slate-100 px-4 py-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <h4 className="font-semibold text-slate-900">{product.name}</h4>
                  <p className="text-sm text-slate-500">
                    {currency(product.price)} / {product.unit || "pc"} | Stock{" "}
                    <span className={product.stock <= 10 ? "font-semibold text-rose-600" : ""}>
                      {product.stock}
                    </span>{" "}
                    | Category{" "}
                    {product.category?.name || product.categoryId}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setProductForm({
                        id: product.id,
                        name: product.name,
                        price: String(product.price),
                        stock: String(product.stock),
                        categoryId: String(product.categoryId)
                      })
                    }
                    className="btn-secondary px-3 py-2"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteProduct(product.id)}
                    className="btn-danger px-3 py-2"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="panel px-6 py-6">
          <div className="mb-5">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-600">
              Staff management
            </p>
            <h3 className="mt-2 text-xl font-bold text-ink">Create picker and staff accounts</h3>
          </div>

          <form onSubmit={handleStaffSubmit} className="space-y-4">
            <input
              className="field"
              placeholder="Name"
              value={staffForm.name}
              onChange={(event) =>
                setStaffForm((current) => ({ ...current, name: event.target.value }))
              }
              required
            />
            <input
              className="field"
              type="email"
              placeholder="Email"
              value={staffForm.email}
              onChange={(event) =>
                setStaffForm((current) => ({ ...current, email: event.target.value }))
              }
              required
            />
            <input
              className="field"
              placeholder="Phone"
              value={staffForm.phone}
              onChange={(event) =>
                setStaffForm((current) => ({ ...current, phone: event.target.value }))
              }
              required
            />
            <input
              className="field"
              type="password"
              placeholder="Password"
              value={staffForm.password}
              onChange={(event) =>
                setStaffForm((current) => ({ ...current, password: event.target.value }))
              }
              required
            />
            <button type="submit" disabled={creatingStaff} className="btn-primary w-full">
              {creatingStaff ? "Creating..." : "Create staff account"}
            </button>
          </form>
        </div>

        <div className="panel px-6 py-6">
          <div className="mb-5">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-600">
              Delivery time slots
            </p>
            <h3 className="mt-2 text-xl font-bold text-ink">Generate and monitor delivery windows</h3>
          </div>

          <form onSubmit={handleGenerateSlots} className="mb-6 flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium text-slate-600">Slot date</label>
              <input
                className="field"
                type="date"
                value={slotDate}
                onChange={(event) => setSlotDate(event.target.value)}
                required
              />
            </div>
            <button type="submit" disabled={generatingSlots} className="btn-primary px-5 py-3">
              {generatingSlots ? "Generating..." : "Generate 4 standard shifts"}
            </button>
          </form>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="px-3 py-3 font-semibold">Date</th>
                  <th className="px-3 py-3 font-semibold">Time</th>
                  <th className="px-3 py-3 font-semibold">Booked</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {upcomingSlots.map((slot) => (
                  <tr key={slot.id} className="border-b border-slate-100 text-slate-700">
                    <td className="px-3 py-3">{new Date(slot.date).toLocaleDateString("en-PH")}</td>
                    <td className="px-3 py-3">{slot.startTime} - {slot.endTime}</td>
                    <td className="px-3 py-3">
                      {slot.bookedCount} / {slot.maxOrders}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={
                          slot.isActive
                            ? "font-medium text-emerald-600"
                            : "font-medium text-slate-400"
                        }
                      >
                        {slot.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {upcomingSlots.length === 0 ? (
              <p className="px-3 py-4 text-sm text-slate-500">No upcoming delivery slots yet.</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="panel px-6 py-6">
          <div className="mb-5">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-600">
              Recent sales
            </p>
            <h3 className="mt-2 text-xl font-bold text-ink">Latest order activity</h3>
          </div>
          <div className="space-y-4">
            {dashboard?.recentOrders.map((order) => (
              <div key={order.id} className="rounded-lg border border-slate-100 px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900">Order #{order.id}</p>
                    <p className="text-sm text-slate-500">{order.customer.name}</p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-slate-500">{formatDateTime(order.createdAt)}</span>
                  <span className="font-semibold text-slate-900">{currency(order.total)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel px-6 py-6">
          <div className="mb-5">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-600">
              Fulfillment
            </p>
            <h3 className="mt-2 text-xl font-bold text-ink">Update order status</h3>
          </div>
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="rounded-lg border border-slate-100 px-4 py-4 md:flex md:items-center md:justify-between"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <p className="font-semibold text-slate-900">Order #{order.id}</p>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {order.delivery?.address || "No delivery address available"}
                  </p>
                </div>
                <select
                  value={order.status}
                  onChange={(event) => handleStatusChange(order.id, event.target.value)}
                  className="field mt-4 w-full md:mt-0 md:max-w-52"
                >
                  <option value="PENDING">Pending</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="PACKING">Packing</option>
                  <option value="OUT_FOR_DELIVERY">Out for delivery</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricCard({ label, value, valueClassName = "text-ink" }) {
  return (
    <div className="panel px-5 py-5">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className={`mt-3 text-3xl font-bold ${valueClassName}`}>{value}</p>
    </div>
  );
}
