async function parseOrdersWithClaude(rawText) {
  let response;
  try {
    response = await fetch("/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText }),
    });
  } catch (e) {
    throw new Error("No se pudo conectar con el servidor.");
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Error al procesar con la IA.");
  }

  const textBlocks = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const cleaned = textBlocks.replace(/```json|```/g, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error("La IA no devolvió un formato válido. Probá de nuevo.");
  }

  if (!parsed || !Array.isArray(parsed.orders)) {
    throw new Error("La respuesta no tuvo la estructura esperada.");
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
