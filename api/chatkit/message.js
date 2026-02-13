// api/chatkit/message.js
// Defensive proxy that tries multiple ChatKit endpoint shapes
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || null;

function safeLog() {
  try { console.log.apply(console, arguments); } catch(e) {}
}

export default async function handler(req, res) {
  // CORS for browser -> Vercel
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, ChatKit-Client-Secret");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");

  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        ok: false,
        problem: "OPENAI_API_KEY_MISSING",
        hint: "Set OPENAI_API_KEY in Vercel env vars"
      });
    }

    const body = req.body || {};
    const client_secret = body.client_secret || req.headers["chatkit-client-secret"] || null;
    const message = body.message;
    const providedThreadId = body.thread_id || body.threadId || null;
    const session_id = body.session_id || body.sessionId || body.session || null;

    if (!client_secret) {
      return res.status(400).json({ ok:false, problem:"MISSING_CLIENT_SECRET", hint:"client_secret required" });
    }
    if (!message) {
      return res.status(400).json({ ok:false, problem:"MISSING_MESSAGE", hint:"message required" });
    }

    // Candidate endpoints to try (in order). We will attempt each with POST.
    // If threadId exists, we prefer append endpoints; otherwise create endpoints.
    const base = "https://api.openai.com/v1/chatkit";

    const createCandidates = [];
    const appendCandidates = [];

    // Candidate shapes for creation (initial message)
    // Try session-scoped endpoints first if we have session_id
    if (session_id) {
      createCandidates.push(`${base}/sessions/${encodeURIComponent(session_id)}/threads`);
      createCandidates.push(`${base}/sessions/${encodeURIComponent(session_id)}/items`);
    }
    // Generic endpoints (some APIs expose /threads directly)
    createCandidates.push(`${base}/threads`);
    createCandidates.push(`${base}/items`);

    // Candidate shapes for appending (add an item to an existing thread)
    if (providedThreadId) {
      appendCandidates.push(`${base}/threads/${encodeURIComponent(providedThreadId)}/items`);
      if (session_id) {
        appendCandidates.push(`${base}/sessions/${encodeURIComponent(session_id)}/threads/${encodeURIComponent(providedThreadId)}/items`);
        appendCandidates.push(`${base}/sessions/${encodeURIComponent(session_id)}/items`);
      }
      appendCandidates.push(`${base}/items`); // fallback generic
    }

    // Build payload shapes to try
    const createPayloads = [
      // common: initial_items array
      {
        initial_items: [
          { type: "user_message", content: [ { type: "input_text", text: message } ] }
        ]
      },
      // alternative: items field
      {
        items: [
          { type: "user_message", content: [ { type: "input_text", text: message } ] }
        ]
      },
      // alternative: content top-level
      { content: message },
      // minimal: a message-like object
      { type: "user_message", content: [ { type: "input_text", text: message } ] }
    ];

    const appendPayloads = [
      { type: "user_message", content: [ { type: "input_text", text: message } ] },
      { items: [ { type: "user_message", content: [ { type: "input_text", text: message } ] } ] },
      { content: message }
    ];

    // Helper to POST and parse
    async function tryPost(url, payload) {
      safeLog("[tryPost] POST", url);
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "OpenAI-Beta": "chatkit_beta=v1",
          "ChatKit-Client-Secret": client_secret
        },
        body: JSON.stringify(payload)
      });
      const data = await resp.json().catch(()=>null);
      return { status: resp.status, ok: resp.ok, data, url };
    }

    // Try append-first if thread_id provided
    let attempts = [];
    if (providedThreadId) {
      for (const url of appendCandidates) {
        for (const payload of appendPayloads) {
          const out = await tryPost(url, payload);
          attempts.push(out);
          if (out.ok) {
            // success: normalize returned thread_id and forward response
            const returnedThreadId = out.data?.id || out.data?.thread_id || providedThreadId || null;
            const respObj = Object.assign({}, out.data || {}, { thread_id: returnedThreadId });
            return res.status(200).json(respObj);
          }
          // If endpoint returns 405 (invalid method), keep trying others
          // If 429/5xx, return it (rate limit / server error) so client can backoff
          if (out.status >= 500 || out.status === 429) {
            return res.status(out.status).json({
              ok:false,
              problem:"OPENAI_ERROR",
              attempted_url: out.url,
              details: out.data
            });
          }
        }
      }
    }

    // No append succeeded (or no thread_id provided) -> try create endpoints
    for (const url of createCandidates) {
      for (const payload of createPayloads) {
        const out = await tryPost(url, payload);
        attempts.push(out);
        if (out.ok) {
          const returnedThreadId = out.data?.id || out.data?.thread_id || out.data?.threadId || null;
          const respObj = Object.assign({}, out.data || {}, { thread_id: returnedThreadId });
          return res.status(200).json(respObj);
        }
        if (out.status >= 500 || out.status === 429) {
          return res.status(out.status).json({
            ok:false,
            problem:"OPENAI_ERROR",
            attempted_url: out.url,
            details: out.data
          });
        }
      }
    }

    // If we reach here, all attempts failed. Return diagnostic info to client.
    safeLog("[chatkit proxy] all attempts failed. attempts:", attempts.map(a=>({url:a.url,status:a.status})));

    const last = attempts[attempts.length-1] || null;
    return res.status(last?.status || 400).json({
      ok: false,
      problem: "OPENAI_ERROR",
      attempted_urls: attempts.map(a => ({ url: a.url, status: a.status, data: a.data })),
      last_attempt: last
    });

  } catch (err) {
    console.error("Handler exception:", err && err.stack ? err.stack : err);
    return res.status(500).json({ ok:false, problem:"HANDLER_EXCEPTION", message:String(err) });
  }
}
