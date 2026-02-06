// api/chatkit/session.js
// Dev-safe: do NOT throw during module load. Read env at module load for reliability,
// but don't crash the function — instead return clear JSON for debugging.

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || null;
const WORKFLOW_ID = process.env.CHATKIT_WORKFLOW_ID || null;

export default async function handler(req, res) {
  try {
    // Basic CORS preflight support (adjust allowed origins as needed)
    const origin = req.headers.origin;
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Allow-Origin", origin || "*");
      return res.status(204).end();
    }
    if (origin) res.setHeader("Access-Control-Allow-Origin", origin);

    // If env missing, return helpful JSON (no secret printed)
    if (!OPENAI_API_KEY) {
      console.error("DEBUG: OPENAI_API_KEY is missing in runtime");
      return res.status(500).json({
        ok: false,
        problem: "OPENAI_API_KEY_MISSING",
        hint: "OPENAI_API_KEY is not present in this runtime. Check Vercel env vars and redeploy.",
        env: {
          CHATKIT_WORKFLOW_ID_present: !!WORKFLOW_ID
        }
      });
    }
    if (!WORKFLOW_ID) {
      console.error("DEBUG: CHATKIT_WORKFLOW_ID missing");
      return res.status(500).json({
        ok: false,
        problem: "CHATKIT_WORKFLOW_ID_MISSING",
        hint: "CHATKIT_WORKFLOW_ID is not set in env vars.",
      });
    }

    const body = (req.body && Object.keys(req.body).length) ? req.body : {};
    const userId = body.user || `anon_${Date.now()}`;

    const resp = await fetch("https://api.openai.com/v1/chatkit/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "OpenAI-Beta": "chatkit_beta=v1",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        workflow: { id: WORKFLOW_ID },
        user: userId,
      }),
    });

    const payload = await resp.json();

    if (!resp.ok) {
      console.error("OpenAI response error:", payload);
      return res.status(500).json({ ok: false, problem: "OPENAI_ERROR", details: payload });
    }

    return res.status(200).json(payload);
  } catch (err) {
    console.error("Handler exception:", err && err.stack ? err.stack : err);
    return res.status(500).json({ ok: false, problem: "HANDLER_EXCEPTION", message: String(err) });
  }
}
