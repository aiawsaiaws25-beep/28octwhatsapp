// WhatsApp Cloud API webhook logic, shared by the local server (bot/server.js)
// and the Vercel serverless function (api/webhook.js).
const crypto = require("crypto");
const { generateReply } = require("./ai");

const env = () => ({
  token: process.env.WHATSAPP_TOKEN,
  phoneId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "skyline-verify",
  appSecret: process.env.WHATSAPP_APP_SECRET,
  graphVersion: process.env.GRAPH_API_VERSION || "v21.0",
});
const isDryRun = () => !env().token || !env().phoneId;

// ---------- Conversation memory (per customer, in memory) ----------
// On Vercel this only lasts while a function instance stays warm.
const MAX_TURNS = 12;
const EXPIRE_MS = 6 * 60 * 60 * 1000;
const chats = new Map(); // phone -> { history, last }

function historyFor(phone) {
  const c = chats.get(phone);
  if (!c || Date.now() - c.last > EXPIRE_MS) chats.set(phone, { history: [], last: Date.now() });
  const chat = chats.get(phone);
  chat.last = Date.now();
  return chat.history;
}

// WhatsApp retries webhooks it thinks failed; skip messages we've already handled
const seen = new Set();
const alreadySeen = (id) => {
  if (seen.has(id)) return true;
  seen.add(id);
  if (seen.size > 5000) seen.delete(seen.values().next().value);
  return false;
};

// ---------- WhatsApp Cloud API ----------
async function graph(body) {
  const { token, phoneId, graphVersion } = env();
  if (isDryRun()) return console.log("[dry run] would send:", JSON.stringify(body));
  const res = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
  });
  if (!res.ok) console.error("WhatsApp API error", res.status, await res.text());
}

const sendText = (to, text) => graph({ to, type: "text", text: { body: text, preview_url: true } });
const markRead = (id) => graph({ status: "read", message_id: id });

async function handleMessage(msg, contact) {
  if (alreadySeen(msg.id)) return;
  const from = msg.from;
  const name = contact?.profile?.name || "";
  markRead(msg.id).catch(() => {});

  if (msg.type !== "text") {
    await sendText(from, "Thanks! I can only read text messages at the moment. Please type your question and I'll help right away.");
    return;
  }

  const text = msg.text.body;
  console.log(`<- ${from}${name ? ` (${name})` : ""}: ${text}`);
  const history = historyFor(from);
  history.push({ role: "user", content: name && history.length === 0 ? `[Customer name: ${name}]\n${text}` : text });

  let reply;
  try {
    reply = await generateReply(history);
  } catch (err) {
    console.error("AI error:", err.message);
    reply = "Thanks for your message! An agent will get back to you shortly. 🙏";
  }
  history.push({ role: "assistant", content: reply });
  while (history.length > MAX_TURNS) history.shift();

  console.log(`-> ${from}: ${reply}`);
  await sendText(from, reply);
}

// ---------- Webhook entry points ----------

// One-time verification handshake from Meta. Returns the challenge to echo, or null.
function verify(params) {
  const ok = params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === env().verifyToken;
  return ok ? params.get("hub.challenge") : null;
}

function validSignature(raw, header) {
  const { appSecret } = env();
  if (!appSecret) return true;
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(raw).digest("hex");
  return !!header && header.length === expected.length && crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

// Replies to every message in a webhook payload; resolves when all replies are sent
function handleWebhook(raw) {
  let body;
  try { body = JSON.parse(raw); } catch { return Promise.resolve(); }
  const jobs = [];
  for (const entry of body.entry || [])
    for (const change of entry.changes || []) {
      const v = change.value || {};
      for (const msg of v.messages || [])
        jobs.push(handleMessage(msg, (v.contacts || []).find((c) => c.wa_id === msg.from)).catch((e) => console.error(e)));
    }
  return Promise.all(jobs);
}

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

module.exports = { verify, validSignature, handleWebhook, readBody, isDryRun, verifyToken: () => env().verifyToken };
