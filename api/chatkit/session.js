// api/chatkit/session.js

// ⬇️ READ ENV AT MODULE LOAD (this is the key fix)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const WORKFLOW_ID = process.env.CHATKIT_WORKFLOW_ID;

if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is missing at build time");
}

export default async function handler(req, res) {
  try {
    const userId = req.body?.user || `anon_${Date.now()}`;

    const r = await fetch("https://api.openai.com/v1/chatkit/sessions", {
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

    const json = await r.json();
    if (!r.ok) {
      console.error("OpenAI error:", json);
      return res.status(500).json(json);
    }

    res.status(200).json(json);
  } catch (err) {
    console.error("Handler error:", err);
    res.status(500).json({ error: err.message });
  }
}
