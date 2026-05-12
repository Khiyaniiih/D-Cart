import { currency } from "../../utils/format";

export function CartItemRow({ item, onQuantityChange, onRemove, busy }) {
  return (
    <div className="grid gap-4 border-b border-slate-100 py-4 md:grid-cols-[1.8fr_0.7fr_0.8fr_0.6fr] md:items-center">
      <div>
        <h3 className="font-semibold text-slate-900">{item.product.name}</h3>
        <p className="text-sm text-slate-500">{item.product.category?.name || "General"}</p>
      </div>
      <p className="text-sm font-medium text-slate-700">{currency(item.product.price)}</p>
      <input
        type="number"
        min="1"
        value={item.quantity}
        onChange={(event) => onQuantityChange(item.productId, Number(event.target.value))}
        className="field max-w-24"
      />
      <div className="flex justify-start md:justify-end">
        <button
          type="button"
          disabled={busy}
          onClick={() => onRemove(item.productId)}
          className="text-sm font-semibold text-rose-600 transition hover:text-rose-700"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
