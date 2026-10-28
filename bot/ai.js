// Generates WhatsApp replies with OpenAI, grounded in the listings from ../data.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const DATA_FILE = path.join(__dirname, "..", "data.js");

// data.js is written for the browser, so run it in a sandbox and pull out its constants.
// It is re-read on every reply, so edits to the listings take effect without a restart.
function loadListings() {
  const code = fs.readFileSync(DATA_FILE, "utf8");
  return vm.runInContext(`${code}\n;PROPERTIES`, vm.createContext({}));
}

const fmtAED = (n) => "AED " + n.toLocaleString("en-US");

function listingsText() {
  return loadListings()
    .map((p) =>
      [
        `Ref ${p.id}: ${p.title}`,
        `${p.purpose === "buy" ? "For sale" : "For rent"}, ${p.type}, ${p.area}`,
        `${fmtAED(p.price)}${p.purpose === "rent" ? " per year" : ""}`,
        `${p.beds === 0 ? "Studio" : p.beds + " bed"}, ${p.baths} bath, ${p.size} sqft`,
        `Amenities: ${p.amenities.join(", ")}`,
        p.desc,
      ].join(" | ")
    )
    .join("\n");
}

function systemPrompt() {
  const site = process.env.SITE_URL ? `\nWebsite: ${process.env.SITE_URL} (a listing opens at ${process.env.SITE_URL}#REF, e.g. #SH-1001)` : "";
  return `You are the WhatsApp assistant for Skyline Homes, a real estate agency in Business Bay, Dubai, UAE.
Office hours: Mon–Sat, 9:00–20:00. Agent phone: +971 55 877 5398.${site}

How to reply:
- This is WhatsApp: keep replies short (usually under 90 words), friendly and professional. Use *bold* for property names and prices, and short lists when showing options. No markdown headings or links in [text](url) form.
- Reply in the customer's language (English, Arabic, Russian, Hindi, etc.).
- Only recommend properties from the CURRENT LISTINGS below, and always give the Ref number. Never invent listings, prices, availability, or features.
- If nothing matches, say so, suggest the closest options, and offer to have an agent look for off-market options.
- To book a viewing, collect the customer's name, the property Ref and preferred day/time, then say an agent will confirm the slot shortly. Do not confirm a time yourself.
- For legal, visa, mortgage approval or exact fee questions, give general guidance only and say an agent will confirm the details.
- If the customer asks for a human, or is upset, say an agent will reply personally soon.
- Do not discuss anything unrelated to property in the UAE; politely steer back.

CURRENT LISTINGS:
${listingsText()}`;
}

async function generateReply(history) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing from .env");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.4,
      max_tokens: 500,
      messages: [{ role: "system", content: systemPrompt() }, ...history],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${data.error?.message || JSON.stringify(data)}`);
  // WhatsApp bold is *text*; models often write markdown **text**
  return data.choices[0].message.content.trim().replace(/\*\*(.+?)\*\*/g, "*$1*");
}

module.exports = { generateReply };
