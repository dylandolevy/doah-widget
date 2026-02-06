// api/chatkit/refresh.js
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  const { client_secret } = req.body || {};
  if (!client_secret) return res.status(400).json({ error: "missing_client_secret" });

  try {
    const r = await fetch("https://api.openai.com/v1/chatkit/sessions/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "OpenAI-Beta": "chatkit_beta=v1",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ client_secret }),
    });
    const json = await r.json();
    if (!r.ok) return res.status(500).json({ error: "refresh_failed", details: json });
    return res.status(200).json(json);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
