import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { rawText } = await req.json();

    const system = `Sos un asistente que interpreta pedidos de un negocio de viandas (comida casera) recibidos como mensajes de WhatsApp...
Reglas:
- Separá los pedidos por cliente y extraé los productos con su cantidad.
- Si no hay forma de identificar al cliente, usá "Pedido 1", "Pedido 2", etc.
- El número de lista del cliente (ej "1.ale") NO es cantidad de producto.
- Sacá montos de dinero del nombre del cliente (ej "Claudia 64.000" -> "Claudia").
- Clasificá cada ítem en: "Helados", "Postres" o "Viandas" (comida salada).
- Devolvé EXCLUSIVAMENTE un JSON válido con la forma:
{"orders":[{"cliente":"string","items":[{"producto":"string","cantidad":number,"categoria":"Helados"|"Postres"|"Viandas"}]}]}
- Si no hay pedidos reconocibles, devolvé {"orders":[]}.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4000,
        system,
        messages: [{ role: "user", content: rawText }],
      }),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
