"use client";

import React, { useState } from "react";
import { ExternalLink, ShoppingBag, CheckCircle2, XCircle, Tag } from "lucide-react";

export interface ProductCardData {
  id?: string;
  title: string;
  price?: number | string | null;
  currency?: string;
  url?: string;
  image_url?: string;
  thumbnail_url?: string;
  sku?: string;
  in_stock?: boolean;
}

interface ProductCardProps {
  product: ProductCardData;
  primaryColor?: string;
  onSelect?: (product: ProductCardData) => void;
}

export function ProductCard({
  product,
  primaryColor = "#f97316",
  onSelect,
}: ProductCardProps) {
  const [imageError, setImageError] = useState(false);
  const imageUrl = product.image_url || product.thumbnail_url;
  const inStock = product.in_stock !== false;

  const formattedPrice = React.useMemo(() => {
    if (product.price === undefined || product.price === null || product.price === "") {
      return null;
    }
    const num = typeof product.price === "number" ? product.price : parseFloat(product.price);
    const curr = product.currency || "USD";
    if (isNaN(num)) return `${product.price} ${curr}`;
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: curr }).format(num);
    } catch {
      return `${curr} ${num.toFixed(2)}`;
    }
  }, [product.price, product.currency]);

  return (
    <div className="my-2.5 w-full max-w-[280px] sm:max-w-[320px] rounded-2xl border border-neutral-200 dark:border-neutral-700/80 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden text-left transition-all hover:shadow-md">
      {/* Product Image */}
      {imageUrl && !imageError ? (
        <div className="relative w-full aspect-[4/3] bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={product.title}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
            loading="lazy"
          />
          <div className="absolute top-2.5 right-2.5">
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm backdrop-blur-md ${
                inStock
                  ? "bg-emerald-500/90 text-white"
                  : "bg-neutral-800/80 text-neutral-300"
              }`}
            >
              {inStock ? (
                <>
                  <CheckCircle2 className="size-3" /> In Stock
                </>
              ) : (
                <>
                  <XCircle className="size-3" /> Out of Stock
                </>
              )}
            </span>
          </div>
        </div>
      ) : (
        <div className="w-full aspect-[4/3] bg-neutral-100 dark:bg-neutral-800 flex flex-col items-center justify-center text-neutral-400 gap-1.5 p-4">
          <ShoppingBag className="size-8 stroke-[1.5]" />
          <span className="text-[11px] font-medium">Product Preview</span>
        </div>
      )}

      {/* Product Details */}
      <div className="p-3 sm:p-3.5 space-y-2">
        <div className="space-y-0.5">
          {product.sku && (
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              SKU: {product.sku}
            </span>
          )}
          <h4 className="text-xs sm:text-[13px] font-bold text-neutral-900 dark:text-white line-clamp-2 leading-snug">
            {product.title}
          </h4>
        </div>

        {formattedPrice && (
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm sm:text-base font-extrabold text-neutral-950 dark:text-neutral-50">
              {formattedPrice}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-1 flex items-center gap-2">
          {product.url && (
            <a
              href={product.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 rounded-xl text-white shadow-sm transition-opacity hover:opacity-90 active:scale-[0.98]"
              style={{ background: primaryColor }}
            >
              <span>View Product</span>
              <ExternalLink className="size-3.5" />
            </a>
          )}
          {onSelect && (
            <button
              type="button"
              onClick={() => onSelect(product)}
              className="inline-flex items-center justify-center p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              title="Ask about this item"
            >
              <Tag className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
