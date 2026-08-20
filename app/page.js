"use client";

import React, { useState, useMemo, useRef } from "react";
import { ClipboardPaste, ChefHat, Copy, Check, Loader2, RotateCcw, Pencil, AlertCircle, Users } from "lucide-react";

const FONT_IMPORT_ID = "totalizador-fonts";

function ensureFonts() {
  if (typeof document === "undefined") return;
  if (document.getElementById(FONT_IMPORT_ID)) return;
  const link = document.createElement("link");
  link.id = FONT_IMPORT_ID;
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Work+Sans:wght@400;500;600;700&display=swap";
  document.head.appendChild(link);
}

const PALETTE = {
  cream: "#F7F2E9",
  cream2: "#EFE7D6",
  ink: "#2B2118",
  inkSoft: "#5A4E3F",
  olive: "#54613A",
  oliveDeep: "#3C4529",
  brick: "#A23B2E",
  mustard: "#CE9A3E",
  line: "#DCD0B6",
  white: "#FFFDF8",
};

const CATEGORIES = [
  { key: "Helados", label: "Helados", accent: "#3E6B8A" },
  { key: "Postres", label: "Postres", accent: "#8A4E6B" },
  { key: "Viandas", label: "Viandas", accent: PALETTE.oliveDeep },
];
const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

let uid = 0;
function nextId() {
  uid += 1;
  return `it_${uid}_${Date.now()}`;
}

function normalizeName(s) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function titleCase(s) {
  return s
    .trim()
    .split(" ")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

async function parseOrdersWithClaude(rawText) {
  let response;
  try {
    response = await fetch("/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText }),
    });
  } catch (e) {
    throw new Error(
      `No se pudo conectar con el servidor (${e && e.name ? e.name : "error de red"}).`
    );
  }

  if (!response.ok) {
    let detail = "";
    try {
      const errBody = await response.text();
      detail = errBody ? ` (${response.status}: ${errBody.slice(0, 200)})` : ` (${response.status})`;
    } catch (e) {
      detail = ` (${response.status})`;
    }
    throw new Error(`No se pudo procesar la solicitud${detail}.`);
  }

  const data = await response.json();
  const textBlocks = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const cleaned = textBlocks.replace(/```json|```/g, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error("No pude leer la respuesta del intérprete. Probá de nuevo.");
  }

  if (!parsed || !Array.isArray(parsed.orders)) {
    throw new Error("La respuesta no tuvo el formato esperado.");
  }

  return parsed.orders.map((o) => ({
    id: nextId(),
    cliente: (o.cliente || "Sin nombre").toString().trim() || "Sin nombre",
    items: (Array.isArray(o.items) ? o.items : []).map((it) => ({
      id: nextId(),
      producto: titleCase((it.producto || "Producto").toString()),
      cantidad: Number.isFinite(Number(it.cantidad)) && Number(it.cantidad) > 0 ? Number(it.cantidad) : 1,
      categoria: CATEGORY_KEYS.includes(it.categoria) ? it.categoria : "Viandas",
    })),
  }));
}

export default function TotalizadorPedidos() {
  ensureFonts();

  const [rawText, setRawText] = useState("");
  const [orders, setOrders] = useState(null);
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(null);
  const textareaRef = useRef(null);

  const totalsByCategory = useMemo(() => {
    const maps = {};
    for (const cat of CATEGORY_KEYS) maps[cat] = new Map();
    if (orders) {
      for (const order of orders) {
        for (const item of order.items) {
          const key = normalizeName(item.producto);
          if (!key) continue;
          const cat = CATEGORY_KEYS.includes(item.categoria) ? item.categoria : "Viandas";
          const map = maps[cat];
          const existing = map.get(key);
          if (existing) {
            existing.cantidad += Number(item.cantidad) || 0;
          } else {
            map.set(key, { producto: item.producto, cantidad: Number(item.cantidad) || 0 });
          }
        }
      }
    }
    const result = {};
    for (const cat of CATEGORY_KEYS) {
      result[cat] = Array.from(maps[cat].values()).sort((a, b) => b.cantidad - a.cantidad);
    }
    return result;
  }, [orders]);

  const totalPedidos = orders ? orders.length : 0;
  const totalUnidades = CATEGORY_KEYS.reduce(
    (sum, cat) => sum + totalsByCategory[cat].reduce((s, t) => s + t.cantidad, 0),
    0
  );

  async function handleProcess() {
    if (!rawText.trim()) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const result = await parseOrdersWithClaude(rawText);
      setOrders(result);
      setStatus("done");
    } catch (e) {
      setErrorMsg(e.message || "Ocurrió un error al procesar los pedidos.");
      setStatus("error");
    }
  }

  function handleReset() {
    setRawText("");
    setOrders(null);
    setStatus("idle");
    setErrorMsg("");
    setCopied(null);
    if (textareaRef.current) textareaRef.current.focus();
  }

  function updateItem(orderId, itemId, field, value) {
    setOrders((prev) =>
      prev.map((o) =>
        o.id !== orderId
          ? o
          : {
              ...o,
              items: o.items.map((it) =>
                it.id !== itemId
                  ? it
                  : { ...it, [field]: field === "cantidad" ? Math.max(0, Number(value) || 0) : value }
              ),
            }
      )
    );
  }

  function updateClienteName(orderId, value) {
    setOrders((prev) => prev.map((o) => (o.id !== orderId ? o : { ...o, cliente: value })));
  }

  function copyCategory(catKey) {
    const items = totalsByCategory[catKey] || [];
    const lines = [
      `PEDIDO A PROVEEDOR — ${catKey.toUpperCase()}`,
      ...items.map((t) => `• ${t.producto}: ${t.cantidad}`),
    ];
    navigator.clipboard
      .writeText(lines.join("\n"))
      .then(() => {
        setCopied(catKey);
        setTimeout(() => setCopied(null), 2000);
      })
      .catch(() => {});
  }

  return (
    <div
      style={{
        fontFamily: "'Work Sans', sans-serif",
        background: PALETTE.cream,
        color: PALETTE.ink,
        minHeight: "100vh",
        padding: "28px 18px 60px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: PALETTE.oliveDeep,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <ChefHat size={22} color={PALETTE.cream} strokeWidth={2} />
          </div>
          <div>
            <h1
              style={{
                fontFamily: "'Fraunces', serif",
                fontWeight: 600,
                fontSize: 26,
                margin: 0,
                color: PALETTE.ink,
                letterSpacing: "-0.01em",
              }}
            >
              Totalizador de pedidos
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: 13.5, color: PALETTE.inkSoft }}>
              Pegá los mensajes de WhatsApp y sacá el total separado por proveedor: helados, postres y viandas.
            </p>
          </div>
        </div>

        {/* Input card */}
        <div
          style={{
            background: PALETTE.white,
            border: `1px solid ${PALETTE.line}`,
            borderRadius: 14,
            padding: 16,
            marginTop: 20,
            boxShadow: "0 1px 2px rgba(43,33,24,0.04)",
          }}
        >
          <label
            htmlFor="orders-input"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              color: PALETTE.inkSoft,
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            <ClipboardPaste size={14} />
            Mensajes pegados
          </label>
          <textarea
            id="orders-input"
            ref={textareaRef}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={
              "Ejemplo:\n\nMaría González: hola! quiero 2 milanesas napolitanas y una sopa de verduras para mañana\n\nJuan 15-4433: 3 tartas de verdura porfa\n\nRosa: como siempre, 1 pollo al horno"
            }
            rows={9}
            style={{
              width: "100%",
              boxSizing: "border-box",
              resize: "vertical",
              border: `1px solid ${PALETTE.line}`,
              borderRadius: 10,
              padding: "12px 14px",
              fontFamily: "'Work Sans', sans-serif",
              fontSize: 14.5,
              lineHeight: 1.5,
              color: PALETTE.ink,
              background: PALETTE.cream,
              outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <button
              onClick={handleProcess}
              disabled={!rawText.trim() || status === "loading"}
              style={{
                flex: "1 1 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                background: !rawText.trim() || status === "loading" ? PALETTE.line : PALETTE.oliveDeep,
                color: !rawText.trim() || status === "loading" ? PALETTE.inkSoft : PALETTE.cream,
                border: "none",
                borderRadius: 10,
                padding: "12px 18px",
                fontSize: 15,
                fontWeight: 600,
                cursor: !rawText.trim() || status === "loading" ? "default" : "pointer",
                fontFamily: "'Work Sans', sans-serif",
              }}
            >
              {status === "loading" ? (
                <>
                  <Loader2 size={17} style={{ animation: "spin 0.9s linear infinite" }} />
                  Procesando pedidos…
                </>
              ) : (
                "Procesar pedidos"
              )}
            </button>
            {(orders || rawText) && status !== "loading" && (
              <button
                onClick={handleReset}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "transparent",
                  color: PALETTE.inkSoft,
                  border: `1px solid ${PALETTE.line}`,
                  borderRadius: 10,
                  padding: "12px 14px",
                  fontSize: 14,
                  cursor: "pointer",
                  fontFamily: "'Work Sans', sans-serif",
                }}
              >
                <RotateCcw size={15} />
                Empezar de nuevo
              </button>
            )}
          </div>
          {status === "error" && (
            <div
              style={{
                marginTop: 12,
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                background: "#FBEAE7",
                border: "1px solid #E3B3AA",
                color: PALETTE.brick,
                borderRadius: 10,
                padding: "10px 12px",
                fontSize: 13.5,
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Results */}
        {orders && status === "done" && (
          <>
            {orders.length === 0 ? (
              <div
                style={{
                  marginTop: 20,
                  textAlign: "center",
                  padding: "28px 16px",
                  color: PALETTE.inkSoft,
                  fontSize: 14.5,
                }}
              >
                No encontré pedidos reconocibles en ese texto. Revisá que esté pegado el mensaje completo e intentá de nuevo.
              </div>
            ) : (
              <>
                {/* Totals */}
                <div style={{ marginTop: 22 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                    <h2
                      style={{
                        fontFamily: "'Fraunces', serif",
                        fontWeight: 600,
                        fontSize: 19,
                        margin: 0,
                        color: PALETTE.ink,
                      }}
                    >
                      Total por proveedor
                    </h2>
                    <span style={{ fontSize: 13, color: PALETTE.inkSoft }}>
                      {totalPedidos} pedido{totalPedidos !== 1 ? "s" : ""} · {totalUnidades} unidades
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {CATEGORIES.map((cat) => {
                      const items = totalsByCategory[cat.key] || [];
                      const catUnidades = items.reduce((s, t) => s + t.cantidad, 0);
                      if (items.length === 0) return null;
                      return (
                        <div
                          key={cat.key}
                          style={{
                            background: cat.accent,
                            borderRadius: 14,
                            padding: 18,
                            color: PALETTE.cream,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                            <h3
                              style={{
                                fontFamily: "'Fraunces', serif",
                                fontWeight: 600,
                                fontSize: 17,
                                margin: 0,
                              }}
                            >
                              {cat.label}
                            </h3>
                            <span style={{ fontSize: 12.5, opacity: 0.85 }}>{catUnidades} unidades</span>
                          </div>
                          <div style={{ marginTop: 12, display: "flex", flexDirection: "column" }}>
                            {items.map((t, i) => (
                              <div
                                key={t.producto + i}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  padding: "8px 2px",
                                  borderTop: i === 0 ? "none" : "1px solid rgba(247,242,233,0.18)",
                                  fontSize: 14,
                                }}
                              >
                                <span>{t.producto}</span>
                                <span
                                  style={{
                                    fontWeight: 700,
                                    background: PALETTE.mustard,
                                    color: PALETTE.ink,
                                    borderRadius: 999,
                                    minWidth: 28,
                                    textAlign: "center",
                                    padding: "2px 10px",
                                    fontSize: 13,
                                  }}
                                >
                                  {t.cantidad}
                                </span>
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={() => copyCategory(cat.key)}
                            style={{
                              marginTop: 14,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 8,
                              width: "100%",
                              background: copied === cat.key ? PALETTE.mustard : "rgba(247,242,233,0.14)",
                              color: copied === cat.key ? PALETTE.ink : PALETTE.cream,
                              border: `1px solid ${copied === cat.key ? PALETTE.mustard : "rgba(247,242,233,0.35)"}`,
                              borderRadius: 10,
                              padding: "9px 14px",
                              fontSize: 13.5,
                              fontWeight: 600,
                              cursor: "pointer",
                              fontFamily: "'Work Sans', sans-serif",
                            }}
                          >
                            {copied === cat.key ? <Check size={15} /> : <Copy size={15} />}
                            {copied === cat.key ? "Copiado" : `Copiar pedido de ${cat.label.toLowerCase()}`}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Per-client breakdown */}
                <div style={{ marginTop: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                    <Users size={16} color={PALETTE.inkSoft} />
                    <h3
                      style={{
                        fontFamily: "'Fraunces', serif",
                        fontWeight: 600,
                        fontSize: 16.5,
                        margin: 0,
                        color: PALETTE.ink,
                      }}
                    >
                      Detalle por cliente
                    </h3>
                    <span style={{ fontSize: 12.5, color: PALETTE.inkSoft, marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
                      <Pencil size={12} /> tocá para corregir
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {orders.map((order) => (
                      <div
                        key={order.id}
                        style={{
                          background: PALETTE.white,
                          border: `1px solid ${PALETTE.line}`,
                          borderRadius: 12,
                          padding: 14,
                        }}
                      >
                        <input
                          value={order.cliente}
                          onChange={(e) => updateClienteName(order.id, e.target.value)}
                          style={{
                            fontFamily: "'Fraunces', serif",
                            fontWeight: 600,
                            fontSize: 15,
                            color: PALETTE.olive,
                            border: "none",
                            background: "transparent",
                            outline: "none",
                            width: "100%",
                            padding: "2px 0 8px",
                            borderBottom: `1px solid ${PALETTE.line}`,
                          }}
                        />
                        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                          {order.items.map((item) => (
                            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <input
                                value={item.producto}
                                onChange={(e) => updateItem(order.id, item.id, "producto", e.target.value)}
                                style={{
                                  flex: 1,
                                  fontSize: 14,
                                  border: `1px solid transparent`,
                                  background: PALETTE.cream,
                                  borderRadius: 7,
                                  padding: "7px 9px",
                                  color: PALETTE.ink,
                                  outline: "none",
                                  fontFamily: "'Work Sans', sans-serif",
                                }}
                              />
                              <input
                                type="number"
                                min={0}
                                value={item.cantidad}
                                onChange={(e) => updateItem(order.id, item.id, "cantidad", e.target.value)}
                                style={{
                                  width: 46,
                                  fontSize: 14,
                                  textAlign: "center",
                                  border: `1px solid ${PALETTE.line}`,
                                  background: PALETTE.cream,
                                  borderRadius: 7,
                                  padding: "7px 4px",
                                  color: PALETTE.ink,
                                  outline: "none",
                                  fontFamily: "'Work Sans', sans-serif",
                                }}
                              />
                              <select
                                value={item.categoria}
                                onChange={(e) => updateItem(order.id, item.id, "categoria", e.target.value)}
                                style={{
                                  fontSize: 12.5,
                                  border: `1px solid ${PALETTE.line}`,
                                  background: PALETTE.cream,
                                  borderRadius: 7,
                                  padding: "7px 4px",
                                  color: PALETTE.inkSoft,
                                  outline: "none",
                                  fontFamily: "'Work Sans', sans-serif",
                                }}
                              >
                                {CATEGORIES.map((c) => (
                                  <option key={c.key} value={c.key}>
                                    {c.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        <p style={{ marginTop: 28, fontSize: 12, color: PALETTE.inkSoft, textAlign: "center" }}>
          Revisá siempre el total antes de mandarlo a producción — la lectura automática puede equivocarse con letra ambigua.
        </p>
      </div>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        textarea:focus, input:focus { outline: 2px solid ${PALETTE.mustard} !important; outline-offset: 1px; }
        button:focus-visible { outline: 2px solid ${PALETTE.mustard}; outline-offset: 2px; }
      `}</style>
    </div>
  );
}
