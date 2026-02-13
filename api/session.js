export const config = {
  runtime: 'edge', // Optional: Makes the function run faster on Vercel's Edge Network
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { OPENAI_API_KEY, WORKFLOW_ID } = process.env;

    if (!OPENAI_API_KEY || !WORKFLOW_ID) {
      return new Response('Missing environment variables', { status: 500 });
    }

    // Call OpenAI to create a ChatKit session
    const openAiResponse = await fetch("https://api.openai.com/v1/chatkit/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "OpenAI-Beta": "chatkit_beta=v1",
      },
      body: JSON.stringify({
        workflow: { id: WORKFLOW_ID },
        // Ideally, pass a unique user ID here from your frontend if you have auth.
        // For now, we use a placeholder or a random ID could be generated on the client.
        user: "guest-user", 
      }),
    });

    if (!openAiResponse.ok) {
      const errorText = await openAiResponse.text();
      return new Response(`OpenAI Error: ${errorText}`, { status: openAiResponse.status });
    }

    const data = await openAiResponse.json();
    
    // Return the client_secret to the frontend
    return new Response(JSON.stringify({ client_secret: data.client_secret }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(`Server Error: ${error.message}`, { status: 500 });
  }
}
