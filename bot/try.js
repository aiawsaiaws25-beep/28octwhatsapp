// Chat with the bot in the terminal, without WhatsApp:
//   node bot/try.js                      (interactive)
//   node bot/try.js "any 2 bed in Marina?" (one question)
require("./env");
const readline = require("readline");
const { generateReply } = require("./ai");

const history = [];
async function ask(text) {
  history.push({ role: "user", content: text });
  const reply = await generateReply(history);
  history.push({ role: "assistant", content: reply });
  console.log(`\nBot: ${reply}\n`);
}

const question = process.argv.slice(2).join(" ");
if (question) {
  ask(question).catch((e) => { console.error(e.message); process.exit(1); });
} else {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "You: " });
  rl.prompt();
  rl.on("line", async (line) => {
    if (line.trim()) await ask(line.trim()).catch((e) => console.error(e.message));
    rl.prompt();
  });
}
