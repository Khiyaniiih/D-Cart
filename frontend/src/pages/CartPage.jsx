import { startTransition, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { cartApi } from "../api/cartApi";
import { CartItemRow } from "../components/cart/CartItemRow";
import { EmptyState } from "../components/common/EmptyState";
import { LoadingState } from "../components/common/LoadingState";
import { currency } from "../utils/format";

export function CartPage() {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isMutating, setIsMutating] = useState(false);

  const loadCart = async () => {
    try {
      const data = await cartApi.get();
      startTransition(() => {
        setCart(data);
      });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load cart.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCart();
  }, []);

  const applyMutation = async (action) => {
    setIsMutating(true);
    setError("");

    try {
      const nextCart = await action();
      setCart(nextCart);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to update cart.");
    } finally {
      setIsMutating(false);
    }
  };

  if (loading) {
    return <LoadingState label="Loading your cart..." />;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        description="Start adding grocery items to prepare your same-day order."
        action={
          <Link to="/products" className="btn-primary">
            Browse products
          </Link>
        }
      />
    );
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.5fr_0.7fr]">
      <div className="panel px-6 py-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-600">
              Cart
            </p>
            <h2 className="mt-2 text-2xl font-bold text-ink">Items ready for checkout</h2>
          </div>
          <button
            type="button"
            onClick={() => applyMutation(() => cartApi.clear())}
            className="text-sm font-semibold text-rose-600"
          >
            Clear cart
          </button>
        </div>

        {error ? <p className="mb-4 text-sm font-medium text-rose-600">{error}</p> : null}

        <div>
          {cart.items.map((item) => (
            <CartItemRow
              key={item.productId}
              item={item}
              busy={isMutating}
              onQuantityChange={(productId, quantity) =>
                applyMutation(() => cartApi.updateItem(productId, { quantity }))
              }
              onRemove={(productId) => applyMutation(() => cartApi.removeItem(productId))}
            />
          ))}
        </div>
      </div>

      <aside className="panel h-fit px-6 py-6">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-600">
          Summary
        </p>
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>Subtotal</span>
            <span className="font-semibold text-slate-900">{currency(cart.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>Delivery</span>
            <span className="font-semibold text-slate-900">Calculated at checkout</span>
          </div>
        </div>
        <Link to="/checkout" className="btn-primary mt-8 w-full">
          Proceed to checkout
        </Link>
      </aside>
    </section>
  );
}
