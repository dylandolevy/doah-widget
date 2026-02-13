// api/chatkit/message.js
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || null;

export default async function handler(req, res) {
  // CORS — always respond to preflight and set allow-origin
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, ChatKit-Client-Secret");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        ok: false,
        problem: "OPENAI_API_KEY_MISSING",
        hint: "Set OPENAI_API_KEY in Vercel environment variables"
      });
    }

    const body = req.body || {};
    const client_secret = body.client_secret || req.headers["chatkit-client-secret"] || null;
    const message = body.message;
    const thread_id = body.thread_id || body.threadId || null;

    if (!client_secret) {
      return res.status(400).json({ ok: false, problem: "MISSING_CLIENT_SECRET", hint: "client_secret required" });
    }
    if (!message) {
      return res.status(400).json({ ok: false, problem: "MISSING_MESSAGE", hint: "message required" });
    }

    const base = "https://api.openai.com/v1/chatkit";
    let apiUrl, payload;

    if (thread_id) {
      apiUrl = `${base}/threads/${encodeURIComponent(thread_id)}/items`;
      payload = {
        type: "user_message",
        content: [{ type: "input_text", text: message }]
      };
    } else {
      apiUrl = `${base}/threads`;
      payload = {
        initial_items: [
          { type: "user_message", content: [{ type: "input_text", text: message }] }
        ]
      };
    }

    // Call OpenAI ChatKit API
    const resp = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "OpenAI-Beta": "chatkit_beta=v1",
        "ChatKit-Client-Secret": client_secret
      },
      body: JSON.stringify(payload)
    });

    const data = await resp.json().catch(() => null);

    if (!resp.ok) {
      // forward OpenAI error body (helpful during dev)
      console.error("OpenAI ChatKit error:", { status: resp.status, url: apiUrl, data });
      return res.status(resp.status).json({
        ok: false,
        problem: "OPENAI_ERROR",
        attempted_url: apiUrl,
        details: data
      });
    }

    // Success: return OpenAI response to client
    // Also, for convenience, include top-level fields thread_id (if available)
    const returnedThreadId = data.id || data.thread_id || data.threadId || thread_id || null;
    const result = Object.assign({}, data, { thread_id: returnedThreadId });

    return res.status(200).json(result);

  } catch (err) {
    console.error("Handler exception:", err && err.stack ? err.stack : err);
    return res.status(500).json({
      ok: false,
      problem: "HANDLER_EXCEPTION",
      message: String(err)
    });
  }
}
