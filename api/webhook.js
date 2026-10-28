// Vercel serverless function for the WhatsApp Cloud API webhook.
// Webhook URL: https://<your-project>.vercel.app/api/webhook
const wa = require("../bot/whatsapp");

module.exports = async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (req.method === "GET") {
    const challenge = wa.verify(url.searchParams);
    res.statusCode = challenge ? 200 : 403;
    return res.end(challenge || "Forbidden");
  }

  if (req.method === "POST") {
    const raw = await wa.readBody(req);
    if (!wa.validSignature(raw, req.headers["x-hub-signature-256"])) {
      res.statusCode = 401;
      return res.end();
    }
    // Serverless functions stop once they respond, so send the reply before acknowledging
    await wa.handleWebhook(raw);
    res.statusCode = 200;
    return res.end("ok");
  }

  res.statusCode = 405;
  res.end();
};
