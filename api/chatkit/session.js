export const config = {
  runtime: "nodejs"
};
// api/chatkit/session.js
export default async function handler(req, res) {
  // Allow only your GitHub Pages origin in production:
  const ALLOWED_ORIGINS = [
    "https://dylandolevy.github.io/doah-widget/", // <- replace with your GitHub Pages domain
    "doah-widget-mq212h4r6-dylans-projects-54783701.vercel.app",
    "doah-widget.vercel.app",
    "https://dylandolevy.github.io"
  ];
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    // allow OPTIONS for health checks / preflight, but reject other origins
    if (req.method !== "OPTIONS") {
      return res.status(403).json({ error: "Origin not allowed" });
    }
  }
  // Preflight response
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  try {
    const body = req.body && Object.keys(req.body).length ? req.body : {};
    const userId = body.user || `anon_${Date.now()}`;

    const resp = await fetch("https://api.openai.com/v1/chatkit/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "OpenAI-Beta": "chatkit_beta=v1",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        workflow: { id: process.env.CHATKIT_WORKFLOW_ID },
        user: userId,
      }),
    });

    const payload = await resp.json();
    if (!resp.ok) {
      console.error("OpenAI error:", payload);
      return res.status(500).json({ error: "failed to create session", details: payload });
    }

    // Return the payload to the frontend; it contains client_secret
    res.status(200).json(payload);
  } catch (err) {
    console.error("Internal error:", err);
    res.status(500).json({ error: "internal_error", details: err.message });
  }
}
