export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { worldState, playerInput } = req.body;
  if (!playerInput) {
    return res.status(400).json({ error: "Missing playerInput" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      missingKey: true,
      narrative: "AI Backend not linked yet! Add your free GEMINI_API_KEY in Vercel Settings -> Environment Variables to unlock full AI alternate history.",
      commands: []
    });
  }

  const systemPrompt = `
You are the simulation engine for an 8-bit Earth Alternate History game.
Current World State:
- Year: ${worldState.yearLabel} (${worldState.eraName})
- Horses in Americas: ${worldState.horsesInAmericas}
- Mammoths Alive: ${worldState.mammothsAlive}
- Sahara Greened: ${worldState.saharaGreen}
- Active Human Tribes: ${worldState.tribes.map(t => t.name).join(', ')}

Player Intervention: "${playerInput}"

Respond ONLY in strict valid JSON (no markdown, no backticks):
{
  "narrative": "2 vivid sentences describing how this alters Earth's history.",
  "commands": [
    // Include ONLY applicable actions from this list:
    // { "type": "unlock_horses_americas" }
    // { "type": "save_mammoths" }
    // { "type": "green_sahara" }
    // { "type": "spawn_tribe", "name": "String", "lat": number, "lon": number }
  ]
}
`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: {
          response_mime_type: "application/json",
          temperature: 0.7
        }
      })
    });

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Empty AI response");

    const parsed = JSON.parse(text);
    return res.status(200).json(parsed);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "AI simulation failed." });
  }
}