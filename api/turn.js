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
    // Only include applicable objects:
    // { "type": "unlock_horses_americas" }
    // { "type": "save_mammoths" }
    // { "type": "green_sahara" }
    // { "type": "spawn_tribe", "name": "String", "lat": number, "lon": number }
  ]
}
`;

  async function callGemini(modelName) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: { response_mime_type: "application/json", temperature: 0.7 }
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || `HTTP ${response.status}`);
    let raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) throw new Error("Empty response");
    raw = raw.replace(/```json|```/gi, '').trim();
    return JSON.parse(raw);
  }

  // Try common Flash models, and if all 404, auto-discover active Flash model on key
  const candidates = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-3.5-flash-lite", "gemini-3.8-flash"];
  let lastErr = "";

  for (const m of candidates) {
    try {
      const parsed = await callGemini(m);
      return res.status(200).json({
        narrative: parsed.narrative || "History shifts across the globe.",
        commands: Array.isArray(parsed.commands) ? parsed.commands : []
      });
    } catch (e) {
      lastErr = e.message;
    }
  }

  // Auto-discover available model via ListModels
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models`, {
      headers: { 'x-goog-api-key': apiKey }
    });
    const listData = await listRes.json();
    const valid = (listData.models || []).find(m =>
      m.supportedGenerationMethods?.includes("generateContent") && m.name.includes("flash")
    ) || (listData.models || []).find(m =>
      m.supportedGenerationMethods?.includes("generateContent")
    );

    if (valid) {
      const cleanName = valid.name.replace("models/", "");
      const parsed = await callGemini(cleanName);
      return res.status(200).json({
        narrative: parsed.narrative || "History shifts across the globe.",
        commands: Array.isArray(parsed.commands) ? parsed.commands : []
      });
    }
  } catch (e) {
    lastErr = e.message;
  }

  return res.status(200).json({ error: `AI Error: ${lastErr}` });
};