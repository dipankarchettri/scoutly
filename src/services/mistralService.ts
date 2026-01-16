
import { analyzeText } from './mistral';
import { Startup } from '../models/Startup';

export interface StartupData {
  name: string;
  description: string;
  website?: string;
  dateAnnounced?: string;
  location?: string;
  investors?: string[];
  teamSize?: string;
  tags?: string[];
  fundingAmount?: string;
  roundType?: string;
  industry?: string;
  contactInfo?: {
    founders?: string[];
    email?: string;
    socials?: Record<string, string>;
  };
}

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  data?: StartupData;
}

export const validateAndExtractStartup = async (articleText: string, dateContext?: string): Promise<ValidationResult> => {
  const prompt = `
    You are a venture capital analyst. Analyze the following article text and determine if it is about a SPECIFIC startup receiving funding or launching a major product.
    
    Context Date: ${dateContext || 'Unknown'} (Use this if article text doesn\'t mention year/date)

    Rules:
    1. If it is a generic industry news, opinion piece, or "top 10" list, return isValid: false.
    2. If it is about a specific startup getting funded, launched, or acquired, return isValid: true.
    3. If valid, extract the structured data.
    4. CRITICAL: Extract FOUNDER NAMES and any CONTACT INFO (email, social links) mentioned.
    5. CRITICAL: "website" field MUST be the STARTUP'S official website (e.g. "company.com"). DO NOT return the article URL (e.g. "techcrunch.com/..."). If not found, return null.
    "dateAnnounced": "YYYY-MM-DD (Use Context Date: ${dateContext || 'Today'} if not explicitly mentioned in text)"
    
    Return ONLY valid JSON in this format:
    {
      "isValid": boolean,
      "reason": "short explanation",
      "data": {
        "name": "Startup Name",
        "dateAnnounced": "YYYY-MM-DD",
        "description": "Brief description",
        // ... other fields
      }
    }
  `;

  try {
    // ... existing networking code ...
    // (Truncate extraction logic same as before)
    const truncatedText = articleText.substring(0, 12000);
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Scoutly",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "mistralai/mistral-7b-instruct:free",
            messages: [
              {
                role: "system",
                content: "You are an expert VC analyst. Output strictly valid JSON."
              },
              {
                role: "user",
                content: prompt + "\n\nArticle Text:\n" + truncatedText
              }
            ]
          })
        });

        if (!response.ok) {
           // ... existing error handling ...
           if (response.status === 429 || response.status === 503) {
            console.log(`Mistral 429/503 (Attempt ${attempt + 1}/${maxRetries}). Retrying in 2s...`);
            await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
            attempt++;
            continue;
          }
          const errorText = await response.text();
          console.error(`Mistral API Error: ${response.status} - ${errorText}`);
          return { isValid: false, reason: "API Error" };
        }

        const data = await response.json();
        const aiResponseContent = data?.choices?.[0]?.message?.content;

        if (!aiResponseContent) {
           return { isValid: false, reason: "AI returned empty response" };
        }

        try {
          const jsonMatch = aiResponseContent.match(/\{[\s\S]*\}/);
          const jsonStr = jsonMatch ? jsonMatch[0] : aiResponseContent;
          const result = JSON.parse(jsonStr) as ValidationResult;
          
          // FALLBACK DATE LOGIC
          if (result.isValid && result.data) {
              if (!result.data.dateAnnounced || result.data.dateAnnounced === 'Unknown') {
                  // Prefer context date, else today
                  let fallback = dateContext;
                  if (!fallback || fallback === 'Unknown') {
                      fallback = new Date().toISOString().split('T')[0];
                  }
                  // Ensure context date is YYYY-MM-DD
                  try {
                       result.data.dateAnnounced = new Date(fallback).toISOString().split('T')[0];
                  } catch (e) {
                       result.data.dateAnnounced = new Date().toISOString().split('T')[0];
                  }
              }
          }

          return result;
        } catch (parseError) {
          console.error("Failed to parse AI JSON:", aiResponseContent);
          return { isValid: false, reason: "Failed to parse AI response" };
        }

      } catch (e) {
        console.error("Mistral Network Error:", e);
        attempt++;
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }

    return { isValid: false, reason: "Max retries exceeded" };

  } catch (error) {
    console.error("Validation error:", error);
    return { isValid: false, reason: "Internal error" };
  }
};

