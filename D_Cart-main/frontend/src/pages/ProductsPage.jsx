import { startTransition, useCallback, useEffect, useState } from "react";
import { categoryApi } from "../api/categoryApi";
import { cartApi } from "../api/cartApi";
import { productApi } from "../api/productApi";
import { EmptyState } from "../components/common/EmptyState";
import { LoadingState } from "../components/common/LoadingState";
import { ProductCard } from "../components/products/ProductCard";

export function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyProductId, setBusyProductId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const loadProducts = useCallback(async () => {
    try {
      const [productResult, categoryResult] = await Promise.all([
        productApi.list(),
        categoryApi.list()
      ]);

      startTransition(() => {
        setProducts(productResult.products);
        setCategories(categoryResult);
      });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load products.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleAddToCart = async (productId) => {
    setBusyProductId(productId);

    try {
      await cartApi.addItem({
        productId,
        quantity: 1
      });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to add item to cart.");
    } finally {
      setBusyProductId(null);
    }
  };

  if (loading) {
    return <LoadingState label="Loading product catalog..." />;
  }

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(normalizedSearch);
    const matchesCategory =
      selectedCategory === "All" || product.category?.name === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 rounded-lg bg-white/70 px-6 py-6 backdrop-blur-sm md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-600">
            Catalog
          </p>
          <h2 className="mt-2 text-3xl font-bold text-ink">Fresh grocery essentials</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Browse products available for same-day delivery in your area.
          </p>
        </div>
      </div>

      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}

      <div className="panel space-y-4 px-5 py-5">
        <input
          type="text"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search products by name"
          className="field"
        />
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setSelectedCategory("All")}
            className={selectedCategory === "All" ? "btn-primary px-4 py-2" : "btn-secondary px-4 py-2"}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelectedCategory(category.name)}
              className={
                selectedCategory === category.name
                  ? "btn-primary px-4 py-2"
                  : "btn-secondary px-4 py-2"
              }
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {products.length === 0 ? (
        <EmptyState
          title="No products available"
          description="Add inventory from the admin area to start receiving orders."
        />
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          title="No matching products"
          description="Try a different search term or switch categories to browse more items."
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={handleAddToCart}
              busy={busyProductId === product.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}
