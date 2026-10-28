// Local server: serves the website and receives WhatsApp Cloud API webhooks.
//   node bot/server.js
// (On Vercel, the website is served statically and api/webhook.js handles the webhook.)
require("./env");
const http = require("http");
const fs = require("fs");
const path = require("path");
const wa = require("./whatsapp");

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, "..");

// Only these files are public, so .env and the bot code are never served
const STATIC = {
  "/": ["index.html", "text/html"],
  "/index.html": ["index.html", "text/html"],
  "/styles.css": ["styles.css", "text/css"],
  "/app.js": ["app.js", "text/javascript"],
  "/data.js": ["data.js", "text/javascript"],
};

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");

    if (url.pathname === "/webhook" || url.pathname === "/api/webhook") {
      if (req.method === "GET") {
        const challenge = wa.verify(url.searchParams);
        res.writeHead(challenge ? 200 : 403).end(challenge || "Forbidden");
        return;
      }
      if (req.method === "POST") {
        const raw = await wa.readBody(req);
        if (!wa.validSignature(raw, req.headers["x-hub-signature-256"])) return res.writeHead(401).end();
        res.writeHead(200).end(); // acknowledge fast; reply in the background
        wa.handleWebhook(raw);
        return;
      }
    }

    const file = STATIC[url.pathname];
    if (req.method === "GET" && file) {
      fs.readFile(path.join(ROOT, file[0]), (err, data) =>
        err ? res.writeHead(500).end() : res.writeHead(200, { "Content-Type": `${file[1]}; charset=utf-8` }).end(data)
      );
      return;
    }
    res.writeHead(404).end("Not found");
  })
  .listen(PORT, () => {
    console.log(`Website:  http://localhost:${PORT}`);
    console.log(`Webhook:  http://localhost:${PORT}/webhook  (verify token: ${wa.verifyToken()})`);
    if (wa.isDryRun()) console.log("WhatsApp credentials not set: replies are printed here instead of sent.");
  });
