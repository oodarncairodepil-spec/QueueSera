import { useCallback, useEffect, useState } from "react";

export interface CartItem {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  sku?: string | null;
  imageUrl?: string | null;
  unitPrice: number;
  quantity: number;
}

const KEY = (slug: string) => `eq:cart:${slug}`;

export function useCart(slug: string) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY(slug));
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setLoaded(true);
  }, [slug]);

  const add = useCallback((item: CartItem) => {
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.variantId === item.variantId);
      const next = idx >= 0
        ? prev.map((p, i) => (i === idx ? { ...p, quantity: p.quantity + item.quantity } : p))
        : [...prev, item];
      localStorage.setItem(KEY(slug), JSON.stringify(next));
      return next;
    });
  }, [slug]);

  const update = useCallback((variantId: string, quantity: number) => {
    setItems((prev) => {
      const next = quantity <= 0
        ? prev.filter((p) => p.variantId !== variantId)
        : prev.map((p) => (p.variantId === variantId ? { ...p, quantity } : p));
      localStorage.setItem(KEY(slug), JSON.stringify(next));
      return next;
    });
  }, [slug]);

  const remove = useCallback((variantId: string) => update(variantId, 0), [update]);

  const clear = useCallback(() => {
    localStorage.removeItem(KEY(slug));
    setItems([]);
  }, [slug]);

  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  return { items, subtotal, itemCount, loaded, add, update, remove, clear };
}