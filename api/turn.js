export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { worldState, playerInput } = req.body;

  if (!playerInput) {
    return res.status(400).json({ error: "No player action provided." });
  }

  const systemPrompt = `
You are the simulation engine for a dynamic Earth Alternate History game.
Current State:
- Era: ${worldState.era}
- Year: ${worldState.year}
- Dominant Life: ${worldState.dominant}
- Atmosphere: ${worldState.oxygen}% Oxygen, ${worldState.temp}°C
- Technology/Culture Level: ${worldState.tech}

The player made this cosmic/evolutionary/civilization intervention:
"${playerInput}"

Rules:
1. Assess the realism or chaotic consequence of this intervention.
2. Advance time forward realistically (millions of years in prehistory, thousands in early human history, centuries or decades in modern eras).
3. If the action is absurd (e.g. "build an atomic bomb in 500,000 BCE"), simulate the realistic *failure* or primitive misinterpretation of that attempt.
4. Keep the story response vivid, immersive, and 2 to 3 sentences long.

Respond ONLY in valid raw JSON with this exact structure (no markdown, no backticks, no comments):
{
  "next_era": "String (name of era)",
  "next_year": "String (e.g. 50,000,000 BCE or 1200 CE)",
  "story": "2-3 vivid sentences describing what happened.",
  "stat_changes": {
    "temp": 0,
    "oxygen": 0
  },
  "dominant": "String (species or faction ruling)",
  "tech": "String (new tech level)",
  "suggested_ideas": ["Action Idea 1", "Action Idea 2"]
}
`;

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY environment variable is missing on Vercel." });
    }

    // Using Gemini 2.5 Flash / 1.5 Flash via REST API
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

    if (!data.candidates || !data.candidates[0].content.parts[0].text) {
      throw new Error("Invalid response from AI provider.");
    }

    const result = JSON.parse(data.candidates[0].content.parts[0].text);
    return res.status(200).json(result);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to simulate the era. Check API key or logs." });
  }
}