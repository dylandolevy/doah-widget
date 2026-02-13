// api/chatkit/message.js
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || null;

export default async function handler(req, res) {
  try {
    // CORS headers
    const origin = req.headers.origin;
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Allow-Origin", origin || "*");
      return res.status(204).end();
    }
    if (origin) res.setHeader("Access-Control-Allow-Origin", origin);

    // Check for API key
    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        ok: false,
        problem: "OPENAI_API_KEY_MISSING",
        hint: "OPENAI_API_KEY is not present in environment variables"
      });
    }

    const { client_secret, message, thread_id } = req.body;

    if (!client_secret) {
      return res.status(400).json({
        ok: false,
        problem: "MISSING_CLIENT_SECRET",
        hint: "client_secret is required"
      });
    }

    if (!message) {
      return res.status(400).json({
        ok: false,
        problem: "MISSING_MESSAGE",
        hint: "message is required"
      });
    }

    // Build request body
    const requestBody = {
      message: message
    };

    // Include thread_id if provided (for continuing conversations)
    if (thread_id) {
      requestBody.thread_id = thread_id;
    }

    console.log('Sending message to OpenAI workflow...');

    // Send message to OpenAI ChatKit workflow
    const resp = await fetch("https://api.openai.com/v1/chatkit/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "OpenAI-Beta": "chatkit_beta=v1",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "ChatKit-Client-Secret": client_secret
      },
      body: JSON.stringify(requestBody)
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error("OpenAI response error:", data);
      return res.status(resp.status).json({ 
        ok: false, 
        problem: "OPENAI_ERROR", 
        details: data 
      });
    }

    console.log('Message sent successfully');

    // Return the response from OpenAI
    // This should include the assistant's response and thread_id
    return res.status(200).json(data);

  } catch (err) {
    console.error("Handler exception:", err && err.stack ? err.stack : err);
    return res.status(500).json({ 
      ok: false, 
      problem: "HANDLER_EXCEPTION", 
      message: String(err) 
    });
  }
}
