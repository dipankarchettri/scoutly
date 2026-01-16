import dotenv from 'dotenv';
dotenv.config();

export async function analyzeText(text: string, prompt: string) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY in .env");
  }

  const url = "https://openrouter.ai/api/v1/chat/completions";

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://scoutly.ai",
        "X-Title": "Scoutly",
      },
      body: JSON.stringify({
        model: "mistralai/mistral-7b-instruct:free",
        messages: [
          {
            role: "system",
            content: prompt
          },
          {
            role: "user",
            content: text
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      // throw new Error(`OpenRouter/Mistral API Error: ${response.status} - ${error}`);
      console.error(`Mistral API Error: ${response.status} - ${error}`);
      return null;
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content;
    
    // Clean up markdown code blocks if present
    return result?.replace(/```json/g, '').replace(/```/g, '').trim() || null;
  } catch (error) {
    console.error("Mistral analysis failed:", error);
    return null;
  }
}
