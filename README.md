# Skyline Homes Dubai

Real estate website for Dubai with WhatsApp contact buttons (+971 55 877 5398) and an OpenAI-powered bot that answers customers on WhatsApp automatically.

- `index.html`, `styles.css`, `app.js`: the website (static, no build step)
- `data.js`: the listings and the WhatsApp number; the bot answers from this file too
- `api/webhook.js`: WhatsApp webhook for Vercel
- `bot/`: bot logic, plus a local server and a terminal chat for testing

## Run locally

```
cp .env.example .env   # then fill in OPENAI_API_KEY
npm start              # website + webhook at http://localhost:4500
npm run try            # chat with the bot in the terminal
```

## Deploy on Vercel

1. Import this repo in Vercel (framework preset: **Other**, no build command).
2. In **Settings → Environment Variables**, add `OPENAI_API_KEY`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` and optionally `WHATSAPP_APP_SECRET` and `SITE_URL`. Redeploy after adding them.
3. In the Meta app under **WhatsApp → Configuration**, set the callback URL to `https://<your-project>.vercel.app/api/webhook` and use the same verify token, then subscribe to **messages**.

Conversation memory is kept in memory, so on Vercel the bot can forget earlier messages in a chat when a function instance is recycled.
