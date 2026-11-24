// CommonJS export so Vercel runs cleanly without needing package.json
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { worldState, playerInput } = req.body || {};
  if (!playerInput) {
    return res.status(400).json({ error: "No player action provided." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      error: "GEMINI_API_KEY is not set in Vercel -> Settings -> Environment Variables."
    });
  }

  const systemPrompt = `
You are the simulation engine for an 8-bit Earth Alternate History game.
Current State:
- Year: ${worldState?.yearLabel || "300,000 BCE"} (${worldState?.eraName || "Paleolithic"})
- Horses in Americas: ${worldState?.horsesInAmericas}
- Mammoths Alive: ${worldState?.mammothsAlive}
- Sahara Greened: ${worldState?.saharaGreen}
- Active Tribes: ${(worldState?.tribes || []).map(t => t.name).join(', ')}

Player Intervention: "${playerInput}"

Respond ONLY in valid raw JSON (no markdown, no backticks):
{
  "narrative": "2 vivid sentences describing how this alters Earth's history.",
  "commands": [
    // Only include applicable objects from below:
    // { "type": "unlock_horses_americas" }
    // { "type": "save_mammoths" }
    // { "type": "green_sahara" }
    // { "type": "spawn_tribe", "name": "String", "lat": number, "lon": number }
  ]
}
`;

  // Active 2026 Gemini Flash models with fallback chain
  const modelsToTry = ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-2.5-flash"];
  let lastError = "Unknown error";

  for (const model of modelsToTry) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            response_mime_type: "application/json",
            temperature: 0.7
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        lastError = data?.error?.message || `HTTP ${response.status}`;
        continue;
      }

      let rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        lastError = "Empty AI response";
        continue;
      }

      // Clean accidental markdown fences if any
      rawText = rawText.replace(/```json|```/gi, '').trim();
      const parsed = JSON.parse(rawText);

      return res.status(200).json({
        narrative: parsed.narrative || "History shifts subtly across the globe.",
        commands: Array.isArray(parsed.commands) ? parsed.commands : []
      });
    } catch (err) {
      lastError = err.message;
    }
  }

  return res.status(200).json({ error: `AI Error: ${lastError}` });
};