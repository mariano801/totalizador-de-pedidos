import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { rawText } = await req.json();

    const systemPrompt = `Sos un asistente que interpreta pedidos de un negocio de viandas (comida casera) recibidos como mensajes de WhatsApp, pegados tal cual por el dueño del negocio. Los mensajes pueden venir de varios clientes distintos, mezclados, con o sin nombre visible, con errores de tipeo, abreviaturas, emojis, mayúsculas sueltas, etc. Tu trabajo es separarlos por cliente y extraer los productos con su cantidad.

Reglas:
- Si el bloque de texto trae un nombre de contacto o el cliente se identifica a sí mismo, usalo como "cliente".
- Si no hay forma de identificar al cliente, usá "Pedido 1", "Pedido 2", etc. en el orden en que aparecen.
- Es muy común que los pedidos vengan en una LISTA NUMERADA POR CLIENTE, tipo "1.ale", "2.Barbie", "3.hernan". Ese número es solo el orden del cliente en la lista, NO es una cantidad de producto ni parte del nombre.
- El nombre del cliente a veces trae pegado el monto que paga o pagó, por ejemplo "Claudia64.000", "ale Sequera 85.000", "alex pago". Esos números grandes (miles) y la palabra "pago" son plata o estado de pago, no un producto ni una cantidad: sacalos del nombre del cliente y no los uses como ítem. El nombre del cliente queda limpio, ej. "Claudia", "Ale Sequera", "Alex".
- A veces el pedido de un cliente agrupa varios ítems bajo una palabra de categoría en su propia línea, sin cantidad ni "de" (ej. "Proteicas", "Helados", "Alfajores"). Esa palabra de categoría no es un producto en sí.
- Si no se especifica cantidad para un producto, asumí cantidad 1.
- Normalizá el nombre del producto a algo prolijo y consistente.
- Ignorá saludos, agradecimientos, horarios de entrega y direcciones.
- Clasificá cada ítem en: "Helados", "Postres" o "Viandas" (comida salada). Si un ítem no encaja en Helados o Postres, clasificalo como "Viandas".
- Devolvé EXCLUSIVAMENTE un JSON válido, sin texto adicional, sin markdown:
{"orders":[{"cliente":"string","items":[{"producto":"string","cantidad":number,"categoria":"Helados"|"Postres"|"Viandas"}]}]}
- Si el texto no contiene ningún pedido reconocible, devolvé {"orders":[]}.`;

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
        system: systemPrompt,
        messages: [{ role: "user", content: rawText }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error?.message || "Error devuelto por Anthropic" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
