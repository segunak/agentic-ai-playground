import { streamText, tool } from "ai";
import { createAzure } from "@ai-sdk/azure";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Azure provider setup
// ---------------------------------------------------------------------------

const azure = createAzure({
  resourceName: "foundry-miscellaneous",
  apiKey: process.env.FOUNDRY_API_KEY,
});

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

function executeGetCurrentDate() {
  const now = new Date();
  return {
    date: now.toISOString().split("T")[0],
    time: now.toTimeString().split(" ")[0],
    timezone: "UTC",
    formatted: now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  };
}

async function executeGetCharlotteWeather() {
  const url =
    "https://api.open-meteo.com/v1/forecast?" +
    "latitude=35.2271&longitude=-80.8431" +
    "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m" +
    "&daily=temperature_2m_max,temperature_2m_min,weather_code" +
    "&forecast_days=3" +
    "&temperature_unit=fahrenheit" +
    "&wind_speed_unit=mph";

  const weatherCodes = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Foggy", 48: "Depositing rime fog",
    51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
    61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
    80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
    95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail",
  };

  try {
    const response = await fetch(url);
    const data = await response.json();
    const current = data.current;
    const daily = data.daily;

    return {
      city: "Charlotte, NC",
      current: {
        temperature: `${current.temperature_2m}F`,
        feels_like: `${current.apparent_temperature}F`,
        conditions: weatherCodes[current.weather_code] || `Code ${current.weather_code}`,
        humidity: `${current.relative_humidity_2m}%`,
        wind: `${current.wind_speed_10m} mph`,
      },
      forecast: daily.time.map((date, i) => ({
        date,
        high: `${daily.temperature_2m_max[i]}F`,
        low: `${daily.temperature_2m_min[i]}F`,
        conditions: weatherCodes[daily.weather_code[i]] || `Code ${daily.weather_code[i]}`,
      })),
      source: "Open-Meteo API (open-meteo.com)",
    };
  } catch {
    return {
      city: "Charlotte, NC",
      error: "Could not fetch live weather data.",
      fallback: "Charlotte typically has mild weather. Check weather.com for current conditions.",
    };
  }
}

async function executeGetRandomFact() {
  try {
    const response = await fetch("https://uselessfacts.jsph.pl/api/v2/facts/random?language=en");
    const data = await response.json();
    return { fact: data.text, source: data.source, source_url: data.source_url };
  } catch {
    return { fact: "A group of flamingos is called a 'flamboyance'.", source: "Fallback fact" };
  }
}

function executeGetCharlotteCinnamonRollRankings() {
  return {
    source: "Segun Akinyemi's Personal Rankings",
    city: "Charlotte, NC",
    last_updated: "2026",
    rankings: [
      { rank: 1, name: "Honeybear Bake Shop", note: "Available at Mattie Ruth's Coffee in Concord, otherwise order for pickup only. The best cinnamon rolls in Charlotte, period." },
      { rank: 2, name: "Sunflour Bakery", note: "Tied for #2. A Charlotte staple." },
      { rank: 2, name: "Beyond Amazing Donuts", note: "Tied for #2. Don't let the name fool you, their cinnamon rolls are incredible." },
      { rank: 3, name: "The Batch House", note: "Consistently excellent." },
      { rank: 4, name: "Knowledge Perk Coffee", note: "A coffee shop that bakes their own cinnamon rolls in house. Hidden gem." },
      { rank: 5, name: "Sugar Donuts", note: "Also a great spot to buy cinnamon rolls in bulk." },
      { rank: 6, name: "Cinnaholic", note: "Located in Concord. Think Chipotle but for cinnamon rolls, build your own." },
      { rank: 7, name: "The Salty Donut", note: "Great cinnamon rolls but very expensive." },
    ],
    hot_take: "Amelie's French Bakery and Cafe has some of the worst cinnamon rolls in Charlotte. The icing lacks flavor, it's almost like toothpaste in texture, and is just flat out not sweet enough. Furthermore, they often over bake their cinnamon rolls. And nationwide chains like Panera Bread and Cinnabon don't count. Cinnabon specifically is a soupy mess. Quantity does not equate to quality. They just drown their cinnamon rolls in icing. Cinnabon is the McDonald's of cinnamon rolls. Most people went to the mall growing up and that's the only cinnamon rolls they had, so they think they're good. They're not. Expand your horizons.",
    disclaimer: "These are the personal opinions of Segun Akinyemi, workshop facilitator and cinnamon roll enthusiast. Your mileage may vary.",
  };
}

// ---------------------------------------------------------------------------
// Tool definitions for AI SDK
// ---------------------------------------------------------------------------

const ALL_TOOLS = {
  get_current_date: tool({
    description: "Gets the current date and time. Use when the user asks about today's date, the current time, or anything requiring knowledge of the current moment.",
    parameters: z.object({}),
    execute: async () => executeGetCurrentDate(),
  }),
  get_charlotte_weather: tool({
    description: "Gets the current weather and 3-day forecast for Charlotte, North Carolina. Use when someone asks about Charlotte weather, temperature, what to wear, or outdoor conditions.",
    parameters: z.object({}),
    execute: async () => executeGetCharlotteWeather(),
  }),
  get_random_fact: tool({
    description: "Returns a random fun fact. Use when someone asks for something interesting, a fun fact, trivia, or just wants to be entertained.",
    parameters: z.object({}),
    execute: async () => executeGetRandomFact(),
  }),
  get_charlotte_cinnamon_roll_rankings: tool({
    description: "Returns Segun Akinyemi's definitive cinnamon roll rankings for Charlotte, NC. Use when someone asks about food, bakeries, cinnamon rolls, dessert recommendations, or things to eat in Charlotte.",
    parameters: z.object({}),
    execute: async () => executeGetCharlotteCinnamonRollRankings(),
  }),
};

// ---------------------------------------------------------------------------
// Dynamic system prompt
// ---------------------------------------------------------------------------

function buildSystemPrompt(enabledToolNames) {
  if (enabledToolNames.length === 0) {
    return `You are a Data Assistant. You can only answer from what you learned during training. You have no tools available.

If someone asks for real-time information like current weather or recent events after your training cutoff, be honest that you're working from training data and may not have current information. Do your best to help with what you know.

Be concise, friendly, and professional.`;
  }

  const toolDescriptions = {
    get_current_date: "get the current date and time",
    get_charlotte_weather: "check live weather in Charlotte, NC",
    get_random_fact: "fetch a random fun fact",
    get_charlotte_cinnamon_roll_rankings: "look up cinnamon roll rankings for Charlotte, NC",
  };

  const available = enabledToolNames
    .filter((name) => toolDescriptions[name])
    .map((name) => toolDescriptions[name]);

  return `You are a Data Assistant built for the workshop "Agentic AI: From Acronyms to Applications" by Segun Akinyemi.

You have ${available.length} tool${available.length === 1 ? "" : "s"} available: ${available.join(", ")}.

Use your tools when the user's question calls for it. When sharing cinnamon roll rankings, be enthusiastic and share the hot take. Be concise, friendly, and professional.`;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Workshop-Key");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (process.env.WORKSHOP_ACTIVE !== "true") {
    return res.status(403).json({ error: "Workshop is not currently active." });
  }

  // Trusted origin check
  const origin = req.headers["origin"] || "";
  const trustedOrigins = (process.env.TRUSTED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim().toLowerCase())
    .filter(Boolean);

  let isTrustedOrigin = false;
  try {
    if (origin) {
      const hostname = new URL(origin).hostname.toLowerCase();
      isTrustedOrigin = trustedOrigins.some(
        (trusted) => hostname === trusted || hostname.endsWith("." + trusted)
      );
    }
  } catch {
    isTrustedOrigin = false;
  }

  if (!isTrustedOrigin) {
    const workshopKey = req.headers["x-workshop-key"] || req.body?.workshopKey;
    if (!workshopKey || workshopKey !== process.env.WORKSHOP_KEY) {
      return res.status(401).json({ error: "Invalid or missing workshop key." });
    }
  }

  const { messages = [], enabledTools = [] } = req.body;

  if (!messages.length) {
    return res.status(400).json({ error: "Messages array is required." });
  }

  try {
    const tools = {};
    for (const name of enabledTools) {
      if (ALL_TOOLS[name]) {
        tools[name] = ALL_TOOLS[name];
      }
    }

    const systemPrompt = buildSystemPrompt(enabledTools);

    const result = streamText({
      model: azure("gpt-5-mini"),
      system: systemPrompt,
      messages,
      tools: Object.keys(tools).length > 0 ? tools : undefined,
      maxSteps: 5,
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const stream = result.toDataStream();
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }

    res.end();
  } catch (error) {
    console.error("Chat API error:", error);
    if (!res.headersSent) {
      return res.status(500).json({
        error: "Something went wrong. Please try again.",
        details: error.message,
      });
    }
    res.end();
  }
}
