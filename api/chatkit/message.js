// api/chatkit/message.js
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || null;

export default async function handler(req, res) {
  try {
    // CORS
    const origin = req.headers.origin;
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Allow-Origin", origin || "*");
      return res.status(204).end();
    }
    if (origin) res.setHeader("Access-Control-Allow-Origin", origin);

    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        ok: false,
        problem: "OPENAI_API_KEY_MISSING",
        hint: "OPENAI_API_KEY is not present in environment variables"
      });
    }

    // Accept session_id or thread_id from client for flexibility
    const { client_secret, message } = req.body || {};
    let session_id = req.body && (req.body.session_id || req.body.sessionId || null);
    let thread_id = req.body && (req.body.thread_id || req.body.threadId || null);

    console.log('Incoming /api/chatkit/message keys:', Object.keys(req.body || {}));
    console.log('Has client_secret:', !!client_secret, 'session_id present:', !!session_id, 'thread_id present:', !!thread_id);

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

    // We'll attempt to append to an existing thread (if provided),
    // otherwise create a new thread on behalf of the session.
    // ChatKit primarily exposes threads/items, not sessions/{id}/messages. See docs.
    // If you want the frontend to talk directly to OpenAI, hand it the client_secret instead.
    const base = "https://api.openai.com/v1/chatkit";
    let apiUrl;
    let body;

    if (thread_id) {
      // append to an existing thread
      apiUrl = `${base}/threads/${thread_id}/items`;
      // thread items generally expect a structure; we'll use a plain user_message item shape
      body = {
        // include session_id if available so OpenAI can check session scope
        session_id: session_id || undefined,
        // item payload: type and content. If the schema is different, OpenAI will return an informative error.
        type: "user_message",
        content: [
          { type: "input_text", text: message }
        ]
      };
    } else {
      // create a new thread (initial user message)
      apiUrl = `${base}/threads`;
      body = {
        session_id: session_id || undefined,
        // minimal thread creation payload — server will tell us if fields differ
        initial_items: [
          {
            type: "user_message",
            content: [
              { type: "input_text", text: message }
            ]
          }
        ]
      };
    }

    // Send to OpenAI ChatKit endpoints
    const resp = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "OpenAI-Beta": "chatkit_beta=v1",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "ChatKit-Client-Secret": client_secret
      },
      body: JSON.stringify(body)
    });

    // Parse JSON robustly
    const data = await resp.json().catch(() => null);

    if (!resp.ok) {
      // Return the OpenAI error to the client for debugging (useful during dev)
      console.error("OpenAI ChatKit error:", {
        status: resp.status,
        attempted_url: apiUrl,
        body: data
      });
      return res.status(resp.status).json({
        ok: false,
        problem: "OPENAI_ERROR",
        details: data,
        attempted_url: apiUrl
      });
    }

    // success — forward the OpenAI response
    console.log('ChatKit request success:', { attempted_url: apiUrl });
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
