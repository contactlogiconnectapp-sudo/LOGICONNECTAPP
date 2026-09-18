export default async (req) => {
  if (req.method === "GET") {
    return new Response(JSON.stringify({ ok: true, service: "paypal-webhook" }), {
      headers: { "content-type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ error: "not_configured" }), {
    status: 501,
    headers: { "content-type": "application/json" },
  });
};

export const config = { path: "/api/paypal-webhook" };
