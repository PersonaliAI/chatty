"use client";

import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  CreditCard,
  DollarSign,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";

type PaymentProviderId = "stripe" | "paypal" | "lemonsqueezy" | "polar";

export interface GatewayCatalogProduct {
  id: string;
  product_id?: string;
  variant_id?: string;
  price_id?: string;
  provider: PaymentProviderId;
  name: string;
  description?: string | null;
  amount_cents: number;
  currency: string;
  formatted_price: string;
  recurring?: string | null;
  image_url?: string | null;
}

interface SendCheckoutModalProps {
  open: boolean;
  onClose: () => void;
  botId: string;
  sessionId: string | null;
  visitorEmail?: string | null;
  fetchBackend: (path: string, init?: RequestInit) => Promise<Response>;
  showToast: (msg: string, type?: "success" | "error") => void;
  onSuccess: (sessionId: string) => void;
}

export const SendCheckoutModal = memo(function SendCheckoutModal({
  open,
  onClose,
  botId,
  sessionId,
  visitorEmail,
  fetchBackend,
  showToast,
  onSuccess,
}: SendCheckoutModalProps) {
  const [checkoutMode, setCheckoutMode] = useState<"catalog" | "custom">("catalog");
  const [gatewayProducts, setGatewayProducts] = useState<GatewayCatalogProduct[]>([]);
  const [loadingGatewayProducts, setLoadingGatewayProducts] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<GatewayCatalogProduct | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [paymentProvider, setPaymentProvider] = useState<PaymentProviderId | "">("");
  const [connectedGateways, setConnectedGateways] = useState<PaymentProviderId[]>([]);
  const [gatewaysLoaded, setGatewaysLoaded] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("50.00");
  const [paymentCurrency, setPaymentCurrency] = useState("usd");
  const [paymentTitle, setPaymentTitle] = useState("Consultation & Service Deposit");
  const [paymentBusy, setPaymentBusy] = useState(false);

  const loadGatewayProducts = useCallback(async () => {
    if (!botId) return;
    setLoadingGatewayProducts(true);
    try {
      const res = await fetchBackend(`/api/bots/${botId}/integrations/payments/products`);
      if (res.ok) {
        const data = await res.json();
        const rawProds: GatewayCatalogProduct[] = data.products || [];
        // Strictly filter out any one-off ad-hoc quotes generated during in-chat custom checkouts
        const prods = rawProds.filter((p) => {
          const name = (p.name || "").trim().toLowerCase();
          const isAdhoc =
            !p.recurring &&
            !p.description &&
            (name === "consultation & service deposit" ||
              name === "order payment" ||
              name === "custom checkout" ||
              name === "custom payment" ||
              name === "custom deposit");
          return !isAdhoc;
        });
        setGatewayProducts(prods);
        if (prods.length > 0) {
          setSelectedProduct((prev) =>
            prev && prods.some((p) => p.id === prev.id && p.provider === prev.provider)
              ? prev
              : prods[0]
          );
          setCheckoutMode("catalog");
        } else {
          setSelectedProduct(null);
          setCheckoutMode("custom");
        }
      }
    } catch (err) {
      console.error("Failed to load gateway products", err);
    } finally {
      setLoadingGatewayProducts(false);
    }
  }, [botId, fetchBackend]);

  const loadConnectedGateways = useCallback(async () => {
    if (!botId) return;
    try {
      const res = await fetchBackend(`/api/bots/${botId}/integrations/payments`);
      if (!res.ok) return;
      const data = await res.json();
      const providers = (data.providers || {}) as Record<
        string,
        { connected?: boolean; is_active?: boolean }
      >;
      const connected = (["stripe", "paypal", "lemonsqueezy", "polar"] as const).filter(
        (id) => providers[id]?.connected && providers[id]?.is_active !== false
      );
      setConnectedGateways(connected);
      setPaymentProvider((prev) => (prev && connected.includes(prev) ? prev : connected[0] ?? ""));
    } catch (err) {
      console.error("Failed to load connected payment gateways", err);
    } finally {
      setGatewaysLoaded(true);
    }
  }, [botId, fetchBackend]);

  useEffect(() => {
    if (open) {
      setGatewaysLoaded(false);
      void loadConnectedGateways();
      void loadGatewayProducts();
    }
  }, [open, loadConnectedGateways, loadGatewayProducts]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return gatewayProducts;
    return gatewayProducts.filter(
      (p) => p.name.toLowerCase().includes(q) || p.provider.toLowerCase().includes(q)
    );
  }, [gatewayProducts, productSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId) return;

    let titleToSend = paymentTitle.trim();
    let amountToSendCents = Math.round((parseFloat(paymentAmount) || 0) * 100);
    let currencyToSend = paymentCurrency.toLowerCase();
    let providerToSend: string = paymentProvider;
    let variantToSend: string | undefined;

    if (checkoutMode === "catalog" && selectedProduct) {
      variantToSend =
        selectedProduct.variant_id ||
        selectedProduct.product_id ||
        selectedProduct.price_id ||
        selectedProduct.id ||
        undefined;
      titleToSend = selectedProduct.name;
      amountToSendCents = selectedProduct.amount_cents;
      currencyToSend = (selectedProduct.currency || "usd").toLowerCase();
      providerToSend = selectedProduct.provider;
    }

    if (!providerToSend) {
      showToast("Connect a payment gateway in Integrations first.", "error");
      return;
    }
    if (amountToSendCents < 50) {
      showToast("Amount must be at least $0.50", "error");
      return;
    }

    setPaymentBusy(true);
    try {
      const res = await fetchBackend(`/api/bots/${botId}/inbox/send-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          amount_cents: amountToSendCents,
          currency: currencyToSend,
          title: titleToSend || "Payment Request",
          customer_email: visitorEmail || undefined,
          provider: providerToSend,
          variant_id: variantToSend,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to generate checkout link");
      showToast("Checkout link sent to visitor!", "success");
      onClose();
      onSuccess(sessionId);
    } catch (err: any) {
      showToast(err.message || "Error generating checkout link", "error");
    } finally {
      setPaymentBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-950/50 sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0">
              <CreditCard className="size-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-neutral-900 dark:text-white leading-tight">
                Send Checkout Link
              </h4>
              <p className="text-[11px] leading-snug text-neutral-400 mt-0.5">
                Generates a unique, customer-specific hosted payment session.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -mr-1 shrink-0 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg cursor-pointer"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="p-3 border-b border-neutral-100 dark:border-neutral-800 grid grid-cols-2 gap-2 bg-neutral-50/30 dark:bg-neutral-950/30">
          <button
            type="button"
            onClick={() => setCheckoutMode("catalog")}
            className={`min-w-0 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
              checkoutMode === "catalog"
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs"
                : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            <span className="truncate">
              <span className="sm:hidden">Products</span>
              <span className="hidden sm:inline">Synced Products &amp; Plans</span>
            </span>
            {gatewayProducts.length > 0 && (
              <span className="text-[10px] leading-none px-1.5 py-1 rounded-full shrink-0 bg-neutral-700 text-white dark:bg-neutral-200 dark:text-neutral-800 font-mono">
                {gatewayProducts.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setCheckoutMode("custom")}
            className={`min-w-0 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
              checkoutMode === "custom"
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs"
                : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            <span className="truncate">
              <span className="sm:hidden">Custom Amount</span>
              <span className="hidden sm:inline">Custom One-Time Amount</span>
            </span>
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* TAB A: CATALOG PRODUCTS & PRICING PLANS */}
          {checkoutMode === "catalog" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Select Pre-Configured Product or Plan:
                </label>
                <button
                  type="button"
                  onClick={() => void loadGatewayProducts()}
                  className="text-[11px] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw
                    className={`size-3 ${loadingGatewayProducts ? "animate-spin text-[#f97316]" : ""}`}
                  />
                  <span>Refresh</span>
                </button>
              </div>

              {loadingGatewayProducts ? (
                <div className="p-8 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center justify-center">
                  <Loader2 className="size-5 animate-spin text-[#f97316]" />
                </div>
              ) : gatewayProducts.length === 0 ? (
                <div className="p-6 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl text-center space-y-2">
                  <p className="text-xs text-neutral-500">
                    No pre-configured catalog products found in your connected gateway dashboard.
                  </p>
                  <button
                    type="button"
                    onClick={() => setCheckoutMode("custom")}
                    className="text-xs text-[#f97316] font-semibold hover:underline cursor-pointer"
                  >
                    Switch to Custom One-Time Amount &rarr;
                  </button>
                </div>
              ) : (
                <>
                  {/* Search box for products */}
                  <div className="relative">
                    <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Search product title, plan..."
                      className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Products List — padded container so selection border/ring is never clipped */}
                  <div className="space-y-2.5 max-h-60 overflow-y-auto p-1 -mx-1">
                    {filteredProducts.map((prod) => {
                      const isSelected =
                        selectedProduct?.id === prod.id && selectedProduct?.provider === prod.provider;
                      return (
                        <button
                          key={`${prod.provider}-${prod.id}-${prod.price_id || ""}`}
                          type="button"
                          onClick={() => setSelectedProduct(prod)}
                          className={`w-full text-left p-3.5 rounded-2xl border-2 transition-colors flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? "border-emerald-500 bg-emerald-500/[0.06] dark:bg-emerald-500/10 shadow-xs"
                              : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-white dark:bg-neutral-900"
                          }`}
                        >
                          <div className="space-y-0.5 min-w-0 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                                {prod.name}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 uppercase font-semibold text-neutral-600 dark:text-neutral-400 shrink-0">
                                {prod.provider}
                              </span>
                              {prod.recurring && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold shrink-0">
                                  Recurring
                                </span>
                              )}
                            </div>
                            {prod.description && (
                              <p className="text-[11px] text-neutral-400 line-clamp-1">
                                {prod.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2.5 shrink-0">
                            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                              {prod.formatted_price}
                            </span>
                            <div
                              className={`size-5 rounded-full flex items-center justify-center transition-colors ${
                                isSelected
                                  ? "bg-emerald-500 text-white"
                                  : "border border-neutral-200 dark:border-neutral-700 text-transparent"
                              }`}
                            >
                              <Check className="size-3 stroke-[2.5]" />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB B: CUSTOM AMOUNT & TITLE */}
          {checkoutMode === "custom" && (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wide">
                  Select Gateway
                </label>
                {!gatewaysLoaded ? (
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-neutral-400">
                    <Loader2 className="size-3.5 animate-spin" /> Checking connected gateways...
                  </div>
                ) : connectedGateways.length === 0 ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                    No payment gateway is connected. Connect Stripe, PayPal, Lemon Squeezy, or Polar in
                    Dashboard &rarr; Integrations first.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {connectedGateways.map((prov) => (
                      <button
                        key={prov}
                        type="button"
                        onClick={() => setPaymentProvider(prov)}
                        className={`px-3.5 py-2 rounded-xl border-2 text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                          paymentProvider === prov
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300"
                        }`}
                      >
                        {prov === "lemonsqueezy"
                          ? "Lemon Squeezy"
                          : prov === "polar"
                          ? "Polar.sh"
                          : prov === "paypal"
                          ? "PayPal"
                          : "Stripe"}
                      </button>
                    ))}
                  </div>
                )}
                {paymentProvider === "lemonsqueezy" && (
                  <p className="mt-2 text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                    Lemon Squeezy re-prices your store&apos;s primary variant to generate this custom
                    one-time checkout link.
                  </p>
                )}
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wide">
                  Item Description / Title
                </label>
                <input
                  type="text"
                  value={paymentTitle}
                  onChange={(e) => setPaymentTitle(e.target.value)}
                  placeholder="e.g. 1-Hour Strategy Session"
                  className="w-full mt-1 text-xs px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wide">
                    Amount
                  </label>
                  <div className="relative mt-1">
                    <DollarSign className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="number"
                      step="0.01"
                      min="0.50"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wide">
                    Currency
                  </label>
                  <input
                    type="text"
                    value={paymentCurrency}
                    onChange={(e) => setPaymentCurrency(e.target.value.toLowerCase())}
                    placeholder="usd"
                    className="w-full mt-1 text-xs px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 uppercase font-mono text-center focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Security Banner */}
          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-500">
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="size-3.5 text-emerald-500" />
              PCI-DSS Level 1 Hosted Checkout
            </span>
            <span className="font-mono text-[10px] uppercase font-bold text-neutral-400">
              {checkoutMode === "catalog" && selectedProduct
                ? selectedProduct.provider
                : paymentProvider || "-"}
            </span>
          </div>

          {/* Modal Footer */}
          <div className="pt-3 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                paymentBusy ||
                !gatewaysLoaded ||
                connectedGateways.length === 0 ||
                (checkoutMode === "catalog" && !selectedProduct)
              }
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50 min-w-0"
            >
              {paymentBusy && <Loader2 className="size-3.5 animate-spin" />}
              <span className="truncate">
                {checkoutMode === "catalog" && selectedProduct
                  ? `Send "${selectedProduct.name}" (${selectedProduct.formatted_price})`
                  : "Generate & Send Card"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});
