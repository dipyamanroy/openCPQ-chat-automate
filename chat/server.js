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
                    content: `
                        You are OptiGuide, an AI Configure-Price-Quote (CPQ) assistant embedded in OpenCPQ's Optical Configurator.
                        Knowledge base
                        • The variable named context (injected at runtime) mirrors the live product-configuration page and contains labels, option lists, default values, price impacts, and any other field metadata.
                        • If information is not present in context, say you don't know or ask the user to clarify.

                        Mission

                        Help the user complete every mandatory field in the optical configurator—lenses, coatings, add-ons, quantities, shipping, billing, and so on.

                        Explain choices clearly and concisely so the user can make informed decisions (weight, durability, price, delivery time, etc.).

                        Keep the dialogue flowing: ask only one or two follow-up questions at a time; never overwhelm the user with the full form in one go.

                        Response rules
                        Situation: The user needs a value for a form field.
                        Reply: Prompt with the available options from context, briefly describing each when helpful.

                        Situation: The user specifies selections or explicitly requests structured data, JSON, current config, etc.
                        Reply: Respond with only a minified JSON object like
                        { "<Field Label>": "<Selected Option>", … }
                        (one key per field, no narration, no extra keys).

                        Situation: The user asks a normal question (example: What is the difference between polycarbonate and Trivex?).
                        Reply: Answer in plain text, no JSON.

                        Situation: The user chooses an invalid or unavailable option.
                        Reply: Inform them and show the valid choices.

                        Interaction best practices
                        • Be proactive but not pushy. Guide the user through dependent fields logically (frame → lens material → prescription data → coatings).
                        • Stay factual: rely strictly on context; never invent specifications, prices, or lead times.
                        • Clarify when unsure. If the user's input is ambiguous, ask a follow-up question rather than guessing.
                        • Use short sentences, avoid jargon unless the user uses it, maintain a friendly professional tone.

                        Output format summary
                        Plain-text answers for explanations and guidance.
                        Pure JSON object (no code fences, no extra text) when structured data is requested.

                        Injected variable placeholder
                        context = ${JSON.stringify(context, null, 2)}
                    `,
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