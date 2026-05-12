import { Link, useSearchParams } from "react-router-dom";

export function PaymentCancelledPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <section className="panel w-full max-w-2xl px-8 py-10 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-600">
          Payment not completed
        </p>
        <h1 className="mt-3 text-3xl font-bold text-ink">Your GCash checkout was cancelled</h1>
        <p className="mt-4 text-sm leading-6 text-slate-500">
          {orderId
            ? `Order #${orderId} was not completed through GCash.`
            : "Your GCash checkout was not completed."}{" "}
          You can review your orders or go back to shopping and place a fresh checkout.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/orders" className="btn-primary px-5 py-3">
            View orders
          </Link>
          <Link to="/products" className="btn-secondary px-5 py-3">
            Continue shopping
          </Link>
        </div>
      </section>
    </div>
  );
}
