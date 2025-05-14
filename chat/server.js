const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const OpenAI = require("openai");
require("dotenv").config();
const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

app.post("/chat", async (req, res) => {
    const { userMessage, context } = req.body;
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `You are a helpful configure-price-quote chatbot. Use the following website content to answer user questions:\n\n${JSON.stringify(context, null, 2)}\n\nGuide the user to fill the forms. If the user is asking for structured data, respond as JSON with the label and selected option as fields. For regular questions or information, respond with plaintext.`,
                },
                { role: "user", content: userMessage },
            ],
            temperature: 0.7,
            max_tokens: 300,
        });

        const replyText = completion.choices[0].message.content;

        // Check if the response is likely intended to be JSON
        const isJsonResponse = replyText.trim().startsWith('{') && replyText.trim().endsWith('}');

        if (isJsonResponse) {
            try {
                const parsedReply = JSON.parse(replyText);
                console.log('Parsed JSON reply:', parsedReply);
                res.json({
                    type: "json",
                    content: parsedReply
                });
            } catch (err) {
                // If parsing fails, send as plaintext
                console.log('Failed to parse as JSON, sending as plaintext:', replyText);
                res.json({
                    type: "plaintext",
                    content: replyText
                });
            }
        } else {
            // Send as plaintext
            console.log('Plaintext reply:', replyText);
            res.json({
                type: "plaintext",
                content: replyText
            });
        }

    } catch (err) {
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