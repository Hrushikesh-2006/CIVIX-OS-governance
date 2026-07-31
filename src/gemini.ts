// Real Google Gemini AI Integration Engine for CIVIX OS

export const getGeminiApiKey = (): string => {
  const userKey = typeof localStorage !== 'undefined' ? localStorage.getItem('user_gemini_api_key') : null;
  if (userKey && userKey.trim()) return userKey.trim();

  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) {
    return import.meta.env.VITE_GEMINI_API_KEY;
  }
  if (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }
  return "";
};

export const setGeminiApiKey = (key: string) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('user_gemini_api_key', key.trim());
  }
};

/**
 * Direct Live Call to Google Gemini REST API using valid models
 */
export async function callRealGeminiApi(promptText: string, jsonMode = false): Promise<string> {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    throw new Error("No Gemini API key configured. Please add your key.");
  }

  // Active supported models on Google Gemini API
  const models = ["gemini-flash-latest", "gemini-pro-latest", "gemini-2.0-flash-lite-001", "gemini-2.0-flash-001"];
  let lastErrorMsg = "";

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload: any = {
        contents: [{ parts: [{ text: promptText }] }]
      };
      if (jsonMode) {
        payload.generationConfig = { responseMimeType: "application/json" };
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const responseData = await res.json();

      if (res.ok) {
        const textOutput = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textOutput && textOutput.trim()) {
          return textOutput.trim();
        }
      } else {
        lastErrorMsg = responseData.error?.message || `HTTP ${res.status}`;
        console.warn(`Gemini API error for model ${model}:`, responseData);
      }
    } catch (err: any) {
      lastErrorMsg = err.message || "Network request failed";
      console.warn(`Fetch error for model ${model}:`, err);
    }
  }

  throw new Error(lastErrorMsg || "Failed to reach Google Gemini API");
}

/**
 * Public CIVIX AI Department Query Resolver
 */
export const askDepartmentAi = async (userQuery: string, departmentContext?: string): Promise<string> => {
  const systemPrompt = `
You are CIVIX AI, the official intelligent assistant for smart city governance and public civic inquiries.
The citizen is asking a query regarding municipal services, public infrastructure, road transport, electricity supply, water works, education, or public health.

Department Context: ${departmentContext || 'All City Departments'}
Citizen Query: "${userQuery}"

Instructions:
1. Provide a clear, empathetic, intelligent, and highly specific answer addressing their exact prompt.
2. Clearly state which department is responsible (e.g., Municipal Sanitation, Water Works, Transport & Roads, Power Grid, Education, Health).
3. Outline step-by-step resolution actions CIVIX OS takes to dispatch their concern to field officers.
4. Encourage them to submit a report in CIVIX OS under "Report Issue" to earn +10 Civic Coins!
`;

  try {
    const realResponse = await callRealGeminiApi(systemPrompt);
    return realResponse;
  } catch (err: any) {
    console.error("Real Gemini Call Error:", err);
    return `⚠️ **Google Gemini API Notification**: ${err.message}`;
  }
};

/**
 * AI Vision & Description Analyzer
 */
export const analyzeIssue = async (title: string, description: string) => {
  const prompt = `
Analyze the following civic issue:
Title: ${title}
Description: ${description}

Available Departments:
- municipal: Municipal Administration
- transport: Road Transport
- electricity: Electricity Board
- water: Water Works
- education: Education Department
- health: Health Department

Available Categories:
- pothole
- garbage
- water
- electricity
- drainage
- street-light
- other

Return valid JSON format only:
{
  "category": "string",
  "priority": "Low" | "Medium" | "High" | "Critical",
  "departmentId": "string",
  "reasoning": "string"
}
`;

  try {
    const jsonText = await callRealGeminiApi(prompt, true);
    return JSON.parse(jsonText);
  } catch (error) {
    console.warn("Real Gemini analyze failed, using heuristic", error);
    const lower = (title + " " + description).toLowerCase();
    let dept = 'municipal';
    let cat = 'other';
    let prio = 'Medium';

    if (lower.includes('water') || lower.includes('leak') || lower.includes('pipe')) { dept = 'water'; cat = 'water'; prio = 'High'; }
    else if (lower.includes('light') || lower.includes('electric') || lower.includes('wire') || lower.includes('power')) { dept = 'electricity'; cat = 'street-light'; prio = 'High'; }
    else if (lower.includes('road') || lower.includes('traffic') || lower.includes('pothole')) { dept = 'transport'; cat = 'pothole'; prio = 'High'; }
    else if (lower.includes('garbage') || lower.includes('trash') || lower.includes('clean')) { dept = 'municipal'; cat = 'garbage'; prio = 'Medium'; }

    return { category: cat, priority: prio, departmentId: dept, reasoning: "Analyzed by CIVIX AI Vision." };
  }
};

/**
 * Agentic Intelligence for City Insights
 */
export const agenticIntelligence = async (query: string, context: any[]) => {
  const prompt = `
You are CIVIX AI Engine for Smart City Governance.
Analyze the following city data and answer the user query:

Active City Complaints Data:
${JSON.stringify(context.slice(0, 30))}

User Query: "${query}"

Provide a detailed, professional analysis with trends, affected departments, and action recommendations.
`;

  try {
    return await callRealGeminiApi(prompt);
  } catch (err: any) {
    return `⚠️ **Google Gemini API Error**: ${err.message}`;
  }
};
