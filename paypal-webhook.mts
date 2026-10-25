// Webhook PayPal -> LogiConnect (fonds bloques).
// Securite : l'evenement n'est accepte QUE si PayPal confirme sa signature (verify-webhook-signature).
// Variables Netlify requises : PAYPAL_ENV ("sandbox" ou "live"), PAYPAL_CLIENT_ID, PAYPAL_SECRET,
// PAYPAL_WEBHOOK_ID, ESCROW_WEBHOOK_SECRET.
const env = (k: string): string =>
  (typeof process !== "undefined" && process.env && process.env[k]) ||
  (typeof Netlify !== "undefined" && (Netlify as any).env && (Netlify as any).env.get && (Netlify as any).env.get(k)) ||
  "";

const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });

async function paypalVerified(req: Request, event: unknown): Promise<boolean> {
  const base = env("PAYPAL_ENV") === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const id = env("PAYPAL_CLIENT_ID"), secret = env("PAYPAL_SECRET"), webhookId = env("PAYPAL_WEBHOOK_ID");
  if (!id || !secret || !webhookId) return false;
  const tokRes = await fetch(base + "/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(id + ":" + secret), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!tokRes.ok) return false;
  const tok = (await tokRes.json()).access_token;
  const h = req.headers;
  const vRes = await fetch(base + "/v1/notifications/verify-webhook-signature", {
    method: "POST",
    headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_algo: h.get("paypal-auth-algo"),
      cert_url: h.get("paypal-cert-url"),
      transmission_id: h.get("paypal-transmission-id"),
      transmission_sig: h.get("paypal-transmission-sig"),
      transmission_time: h.get("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: event,
    }),
  });
  if (!vRes.ok) return false;
  return (await vRes.json()).verification_status === "SUCCESS";
}

export default async (req: Request) => {
  if (req.method === "GET") {
    return json(200, {
      ok: true,
      service: "paypal-webhook",
      configured: !!(env("PAYPAL_CLIENT_ID") && env("PAYPAL_SECRET") && env("PAYPAL_WEBHOOK_ID") && env("ESCROW_WEBHOOK_SECRET")),
      mode: env("PAYPAL_ENV") === "live" ? "live" : "sandbox",
    });
  }
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  let event: any;
  try { event = await req.json(); } catch { return json(400, { error: "invalid_json" }); }

  // 1) Signature PayPal obligatoire : sinon n'importe qui pourrait simuler un paiement.
  let ok = false;
  try { ok = await paypalVerified(req, event); } catch { ok = false; }
  if (!ok) return json(401, { error: "signature_invalide" });

  const type = event.event_type || "";
  if (type !== "PAYMENT.CAPTURE.COMPLETED" && type !== "CHECKOUT.ORDER.COMPLETED") {
    return json(200, { ignored: type || "unknown" });
  }
  const resource = event.resource || {};
  const commandeId = String(resource.custom_id || resource.custom || "");
  const txnId = String(resource.id || event.id || "");
  if (!commandeId) return json(202, { accepted: false, reason: "missing_custom_id" });

  // 2) L'etat de la commande ne peut avancer qu'une fois : un evenement rejoue est refuse par la base.
  const secret = env("ESCROW_WEBHOOK_SECRET");
  if (!secret) return json(503, { error: "not_configured" });
  const res = await fetch("https://fhabovjsikqshprnltci.supabase.co/rest/v1/rpc/escrow_webhook_fonds_bloques", {
    method: "POST",
    headers: {
      apikey: "sb_publishable_hr4XxgInVGT-RmavqsV3ig_mBsNYLkN",
      Authorization: "Bearer sb_publishable_hr4XxgInVGT-RmavqsV3ig_mBsNYLkN",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_secret: secret, p_commande_id: commandeId, p_psp: "paypal", p_txn_id: txnId }),
  });
  const text = await res.text();
  if (!res.ok) return json(res.status, { error: text });
  return json(200, { ok: true, result: text });
};
export const config = { path: "/api/paypal-webhook" };
