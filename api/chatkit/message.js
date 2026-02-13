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

    // Accept either session_id or thread_id for compatibility
    const { client_secret, message } = req.body || {};
    let session_id = req.body && (req.body.session_id || req.body.thread_id || req.body.id || null);

    // Debug logging (keep lightweight; don't log secrets in production)
    console.log('Incoming /api/chatkit/message request body keys:', Object.keys(req.body || {}));
    console.log('Resolved session_id:', session_id ? '[REDACTED]' : null);

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

    if (!session_id) {
      return res.status(400).json({
        ok: false,
        problem: "MISSING_SESSION_ID",
        hint: "session_id is required. This should be the 'id' or 'session_id' field from the session creation response."
      });
    }

    console.log('Sending message to ChatKit session:', '[REDACTED]');

    // Use session ID in the URL
    const apiUrl = `https://api.openai.com/v1/chatkit/sessions/${session_id}/messages`;

    const resp = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "OpenAI-Beta": "chatkit_beta=v1",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "ChatKit-Client-Secret": client_secret
      },
      body: JSON.stringify({
        content: message
      })
    });

    const data = await resp.json().catch(() => null);

    if (!resp.ok) {
      console.error("OpenAI response error:", data);
      return res.status(resp.status).json({
        ok: false,
        problem: "OPENAI_ERROR",
        details: data,
        attempted_url: apiUrl
      });
    }

    console.log('Message sent successfully to ChatKit');

    // Return the response from OpenAI
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
