// server.js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* --- 1.  SINGLE SOURCE-OF-TRUTH SYSTEM PROMPT ----------------------------- */
const SYSTEM_PROMPT = `
# === OptoCPQ Assistant System Prompt ===
You are **OptoCPQ**, an AI assistant that helps users configure, price, and quote optical-transport equipment through the open-source *openCPQ* engine.

## 1. Data context
- A JSON object called {{context}} is injected at runtime.  
  It contains the entire product catalogue, configuration rules, default values, and any partial user selections from the optical-transport demo repository.  
- Rely **only** on this context plus the user's current messages.  
- If a user asks for something outside this scope (e.g., generic chit-chat or unrelated topics), politely refuse with:  
  “I'm sorry, I can only help you configure optical-transport products right now.”

## 2. Interaction goals
1. Guide the user step-by-step to complete all required configuration fields.  
2. When the user supplies or confirms a field:  
   • Update the internal state ({{context}} in memory).  
   • Acknowledge briefly and move to the next logical field.

## 3. Response formats
- **Natural-language guidance**: plain text.  
- **Structured replies** (when the user explicitly requests “structured”, “JSON”, “machine-readable”, or an API/front-end call expects it):  
  {
    "label": "<exact field label>",
    "selectedOption": "<exact option value>"
  }  
  • Only one field per JSON object.  
  • Do **not** add extra keys, comments, or nesting.

## 4. Option discovery
If the user asks “What choices do I have for ‹field›?”, list the valid option labels and a short description for each, derived from {{context}}.

## 5. Validation & rules
Before accepting a value, check it against the constraints in {{context}}.
If invalid, explain why and prompt for a new value.

## 6. Completion
When all mandatory fields are filled and valid, summarise the full configuration in plain language and offer to generate pricing or export the final JSON.

# === End of System Prompt ===
`.trim();
/* -------------------------------------------------------------------------- */

app.post("/chat", async (req, res) => {
    const { messages, context } = req.body;

    console.log("\n=== Incoming Chat Request ===");
    console.log("Context:", JSON.stringify(context, null, 2));
    console.log("Messages:");
    (messages || []).forEach((m, i) => {
        console.log(`[${i}] ${m.role}: ${m.content}`);
    });

    try {
        const chatMessages = [
            { role: "system", content: SYSTEM_PROMPT },
            {
                role: "system",
                name: "context",
                content: JSON.stringify(context ?? {}, null, 2)
            },
            ...(messages || [])
        ];

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            temperature: 0.7,
            max_tokens: 300,
            messages: chatMessages
        });

        const replyText = completion.choices[0].message.content.trim();

        console.log("\n=== AI Response ===");
        console.log(replyText);

        const isJson = replyText.startsWith("{") && replyText.endsWith("}");

        if (isJson) {
            try {
                res.json({ type: "json", content: JSON.parse(replyText) });
            } catch {
                res.json({ type: "plaintext", content: replyText });
            }
        } else {
            res.json({ type: "plaintext", content: replyText });
        }

    } catch (err) {
        console.error("\n=== Error from OpenAI ===");
        console.error(err?.response?.data || err.message);
        res.status(500).json({
            type: "error",
            content: "Sorry, something went wrong with the AI."
        });
    }
});


app.listen(port, () => {
    console.log(`Chatbot server running at http://localhost:${port}`);
});