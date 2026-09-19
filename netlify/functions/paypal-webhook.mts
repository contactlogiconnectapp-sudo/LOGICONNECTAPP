export default async (req) => {
  const json = (s, b) => new Response(JSON.stringify(b), {
    status: s,
    headers: { "content-type": "application/json" },
  });
  if (req.method === "GET") return json(200, { ok: true, service: "paypal-webhook" });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  let event;
  try { event = await req.json(); } catch { return json(400, { error: "invalid_json" }); }
  const type = event.event_type || "";
  if (type !== "PAYMENT.CAPTURE.COMPLETED" && type !== "CHECKOUT.ORDER.COMPLETED") {
    return json(200, { ignored: type || "unknown" });
  }
  const resource = event.resource || {};
  const commandeId = String(resource.custom_id || resource.custom || "");
  const txnId = String(resource.id || event.id || "");
  if (!commandeId) return json(202, { accepted: false, reason: "missing_custom_id" });
  const secret = globalThis.Netlify?.env?.get?.("ESCROW_WEBHOOK_SECRET") || "";
  const res = await fetch("https://fhabovjsikqshprnltci.supabase.co/rest/v1/rpc/escrow_webhook_fonds_bloques", {
    method: "POST",
    headers: {
      apikey: "sb_publishable_hr4XxgInVGT-RmavqsV3ig_mBsNYLkN",
      Authorization: "Bearer sb_publishable_hr4XxgInVGT-RmavqsV3ig_mBsNYLkN",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_secret: secret,
      p_commande_id: commandeId,
      p_psp: "paypal",
      p_txn_id: txnId,
    }),
  });
  const text = await res.text();
  if (!res.ok) return json(res.status, { error: text });
  return json(200, { ok: true, result: text });
};
export const config = { path: "/api/paypal-webhook" };
