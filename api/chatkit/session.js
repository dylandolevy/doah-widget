// api/chatkit/session.js
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || null;
const WORKFLOW_ID = process.env.CHATKIT_WORKFLOW_ID || null;

export default async function handler(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ ok:false, problem:"OPENAI_API_KEY_MISSING", hint:"Set OPENAI_API_KEY in env" });
    }

    // IMPORTANT: you MUST pass an approved workflow id here (from Agent Builder),
    // or the managed ChatKit docs/example will show the workflow id your account uses.
    // Replace workflowId below with the workflow ID you provisioned in Agent Builder.
    const workflowId = process.env.CHATKIT_WORKFLOW_ID || null;

    if (!workflowId) {
      return res.status(500).json({ ok:false, problem:"MISSING_WORKFLOW_ID", hint:"Set CHATKIT_WORKFLOW_ID in env to your workflow ID" });
    }

    const body = {
      user: req.body?.user || `guest-${Date.now()}`,
      workflow: { id: workflowId }
      // you may add expires_after, state_variables, etc.
    };

    const resp = await fetch("https://api.openai.com/v1/chatkit/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "OpenAI-Beta": "chatkit_beta=v1"
      },
      body: JSON.stringify(body)
    });

    const data = await resp.json().catch(()=>null);

    if (!resp.ok) {
      console.error("Create session failed:", resp.status, data);
      return res.status(resp.status).json({ ok:false, problem:"OPENAI_ERROR", details: data });
    }

    // Return the client_secret to the browser
    return res.status(200).json({
      client_secret: data.client_secret,
      expires_at: data.expires_at,
      id: data.id || null
    });

  } catch (err) {
    console.error("session handler error:", err);
    return res.status(500).json({ ok:false, problem:"HANDLER_EXCEPTION", message: String(err) });
  }
}
