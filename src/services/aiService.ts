import { StartupData, ValidationResult } from "./mistralService";

// OpenRouter Configuration
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

// Default model - using a cost-effective option  
// Options: "meta-llama/llama-3.1-8b-instruct" (cheap ~$0.000001/request), "anthropic/claude-3-haiku" (balanced), "openai/gpt-3.5-turbo" (powerful)
const DEFAULT_MODEL = "meta-llama/llama-3.1-8b-instruct"; // Ultra cheap!

// Get API key (lazy to allow dotenv to load first)
const getApiKey = () => {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("OPENROUTER_API_KEY not found in environment variables");
    return key;
};

// Simple delay helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


// OpenRouter API Call
const callOpenRouterAPI = async (prompt: string, modelName: string = DEFAULT_MODEL, maxRetries: number = 3): Promise<string> => {
    let attempt = 0;
    
    while (attempt < maxRetries) {
        try {
            const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${getApiKey()}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://scoutly.app",
                    "X-Title": "Scoutly Startup Scraper"
                },
                body: JSON.stringify({
                    model: modelName,
                    messages: [
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    temperature: 0.2,
                    max_tokens: 2048
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.warn(`OpenRouter API Error (${modelName}): ${response.status} - ${errorText}`);
                
                if (response.status === 429) {
                    console.log("Rate limit hit, retrying...");
                    attempt++;
                    await delay(2000);
                    continue;
                }
                
                throw new Error(`OpenRouter API Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const aiText = data.choices?.[0]?.message?.content;
            
            if (!aiText) throw new Error("Empty response from OpenRouter");
            
            return aiText;
            
        } catch (error: any) {
            console.error(`OpenRouter API attempt ${attempt + 1}/${maxRetries} failed:`, error.message);
            
            attempt++;
            if (attempt >= maxRetries) break;
            
            const backoffTime = Math.min(1000 * Math.pow(2, attempt), 10000);
            await delay(backoffTime);
        }
    }
    
    throw new Error("All API retries exhausted.");
};



export const validateAndExtractStartup = async (articleText: string, dateContext?: string): Promise<ValidationResult> => {
    const prompt = `
    You are a venture capital analyst. Analyze the following article text and determine if it is about a SPECIFIC startup receiving funding or launching a major product.
    
    Context Date: ${dateContext || 'Unknown'} (Use this if article text doesn't mention year/date)

    Rules:
    1. If it is a generic industry news, opinion piece, or "top 10" list, return isValid: false.
    2. If it is about a specific startup getting funded, launched, or acquired, return isValid: true.
    3. If valid, extract the structured data.
    4. CRITICAL: Extract FOUNDER NAMES and any CONTACT INFO (email, social links) mentioned.
    5. CRITICAL: "website" field MUST be the STARTUP'S official website (e.g. "company.com"). DO NOT return the article URL (e.g. "techcrunch.com/..."). If not found, return null.
    6. "dateAnnounced": "YYYY-MM-DD (Use Context Date: ${dateContext || 'Today'} if not explicitly mentioned in text)"
    
    Return ONLY valid JSON in this format, with no markdown code blocks:
    {
      "isValid": boolean,
      "reason": "short explanation",
      "data": {
        "name": "Startup Name",
        "dateAnnounced": "YYYY-MM-DD",
        "description": "Brief description",
        "website": "company.com",
        "fundingAmount": "$X Million",
        "roundType": "Seed/Series A",
        "location": "City, Country",
        "founders": ["Name 1", "Name 2"],
        "industry": "Industry",
        "tags": ["tag1", "tag2"]
      }
    }

    Article Text:
    ${articleText.substring(0, 30000)}
  `;

    try {
        const aiText = await callOpenRouterAPI(prompt);
        
        try {
            // Clean content if it has markdown block
            const cleanJson = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(cleanJson) as ValidationResult;
            
            // Date Fallback Logic
            if (result.isValid && result.data) {
                if (!result.data.dateAnnounced || result.data.dateAnnounced === 'Unknown') {
                    let fallback = dateContext;
                    if (!fallback || fallback === 'Unknown') {
                        fallback = new Date().toISOString().split('T')[0];
                    }
                    try {
                        result.data.dateAnnounced = new Date(fallback).toISOString().split('T')[0];
                    } catch (e) {
                        result.data.dateAnnounced = new Date().toISOString().split('T')[0];
                    }
                }
            }

            return result;

        } catch (parseError) {
            console.error("Failed to parse AI JSON:", aiText.substring(0, 200));
            return { 
                isValid: false, 
                reason: `JSON Parse Error: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}` 
            };
        }

    } catch (error) {
        console.error("OpenRouter API call failed:", error);
        return { 
            isValid: false, 
            reason: `API Error: ${error instanceof Error ? error.message : 'Unknown error'}` 
        };
    }
};

export const extractFounders = async (text: string): Promise<string[]> => {
    const prompt = `
    Extract the names of the FOUNDERS, CO-FOUNDERS, or CEO/CTO from the following About Us/Team page text.
    Return ONLY a JSON array of strings, e.g. ["Elon Musk", "Sam Altman"].
    If none found, return [].
    Rules:
    - Only include real human names.
    - Exclude investors or advisors unless explicitly strictly labeled as co-founder.
    - Return valid JSON only with no additional text.
    
    Text:
    ${text.substring(0, 30000)}
    `;
    
    try {
        const aiText = await callOpenRouterAPI(prompt);
        
        try {
            const cleanJson = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanJson);
        } catch (parseError) {
            console.error("Failed to parse founders JSON:", aiText.substring(0, 200));
            return [];
        }
        
    } catch (error) {
        console.error("OpenRouter founder extraction failed:", error);
        return [];
    }
};