import { streamText, tool, convertToModelMessages, UIMessage, stepCountIs, type ModelMessage } from "ai";
import { createAzure } from "@ai-sdk/azure";
import { z } from "zod";

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

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

  const weatherCodes: Record<number, string> = {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await response.json();
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
      forecast: daily.time.map((date: string, i: number) => ({
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
    };
  }
}

async function executeGetRandomFact() {
  try {
    const response = await fetch("https://uselessfacts.jsph.pl/api/v2/facts/random?language=en");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await response.json();
    return { fact: data.text as string, source: data.source as string };
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
      { rank: 2, name: "Beyond Amazing Donuts", note: "Tied for #2. Their cinnamon rolls are incredible." },
      { rank: 3, name: "The Batch House", note: "Consistently excellent." },
      { rank: 4, name: "Knowledge Perk Coffee", note: "A coffee shop that bakes their own cinnamon rolls in house. Hidden gem." },
      { rank: 5, name: "Sugar Donuts", note: "Also a great spot to buy cinnamon rolls in bulk." },
      { rank: 6, name: "Cinnaholic", note: "Located in Concord. Think Chipotle but for cinnamon rolls, build your own." },
      { rank: 7, name: "The Salty Donut", note: "Great cinnamon rolls but very expensive." },
    ],
    hot_take: "Amelie's French Bakery and Cafe has some of the worst cinnamon rolls in Charlotte. The icing lacks flavor, it's almost like toothpaste in texture, and is just flat out not sweet enough. Furthermore, they often over bake their cinnamon rolls. And nationwide chains like Panera Bread and Cinnabon don't count. Cinnabon specifically is a soupy mess. Quantity does not equate to quality. They just drown their cinnamon rolls in icing. Cinnabon is the McDonald's of cinnamon rolls. Most people went to the mall growing up and that's the only cinnamon rolls they had, so they think they're good. They're not. Expand your horizons.",
    disclaimer: "These are the personal opinions of Segun Akinyemi, workshop facilitator and cinnamon roll enthusiast.",
  };
}

// ---------------------------------------------------------------------------
// AI SDK tool definitions (v6 uses inputSchema)
// ---------------------------------------------------------------------------

const ALL_TOOLS = {
  get_current_date: tool({
    description: "Gets the current date and time. Use when the user asks about today's date, the current time, or anything requiring knowledge of the current moment.",
    inputSchema: z.object({}),
    execute: async () => executeGetCurrentDate(),
  }),
  get_charlotte_weather: tool({
    description: "Gets the current weather and 3-day forecast for Charlotte, North Carolina. Use when someone asks about Charlotte weather, temperature, what to wear, or outdoor conditions.",
    inputSchema: z.object({}),
    execute: async () => executeGetCharlotteWeather(),
  }),
  get_random_fact: tool({
    description: "Returns a random fun fact. Use when someone asks for something interesting, a fun fact, trivia, or just wants to be entertained.",
    inputSchema: z.object({}),
    execute: async () => executeGetRandomFact(),
  }),
  get_charlotte_cinnamon_roll_rankings: tool({
    description: "Returns Segun Akinyemi's definitive cinnamon roll rankings for Charlotte, NC. Use when someone asks about food, bakeries, cinnamon rolls, dessert recommendations, or things to eat in Charlotte.",
    inputSchema: z.object({}),
    execute: async () => executeGetCharlotteCinnamonRollRankings(),
  }),
};

// ---------------------------------------------------------------------------
// Dynamic system prompt
// ---------------------------------------------------------------------------

function buildSystemPrompt(enabledToolNames: string[]): string {
  if (enabledToolNames.length === 0) {
    return `You are a Data Assistant. You can only answer from what you learned during training. You have no tools available.

If someone asks for real-time information like current weather or recent events after your training cutoff, be honest that you're working from training data and may not have current information. Do your best to help with what you know.

Be concise, friendly, and professional.`;
  }

  const toolDescriptions: Record<string, string> = {
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
// Auth helpers
// ---------------------------------------------------------------------------

function isTrustedOrigin(origin: string): boolean {
  const trustedOrigins = (process.env.TRUSTED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim().toLowerCase())
    .filter(Boolean);

  try {
    if (origin) {
      const hostname = new URL(origin).hostname.toLowerCase();
      return trustedOrigins.some(
        (trusted) => hostname === trusted || hostname.endsWith("." + trusted)
      );
    }
  } catch {
    // Invalid URL
  }
  return false;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  if (process.env.WORKSHOP_ACTIVE !== "true") {
    return Response.json({ error: "Workshop is not currently active." }, { status: 403 });
  }

  const origin = req.headers.get("origin") || "";
  if (!isTrustedOrigin(origin)) {
    const cloned = await req.clone().json().catch(() => ({}));
    const workshopKey = req.headers.get("x-workshop-key") || cloned.workshopKey;
    if (!workshopKey || workshopKey !== process.env.WORKSHOP_KEY) {
      return Response.json({ error: "Invalid or missing workshop key." }, { status: 401 });
    }
  }

  const body = await req.json();
  const { messages = [], enabledTools = [] } = body as {
    messages: UIMessage[];
    enabledTools: string[];
  };

  if (!messages.length) {
    return Response.json({ error: "Messages array is required." }, { status: 400 });
  }

  // Build enabled tools
  const tools: Record<string, (typeof ALL_TOOLS)[keyof typeof ALL_TOOLS]> = {};
  for (const name of enabledTools) {
    if (ALL_TOOLS[name as keyof typeof ALL_TOOLS]) {
      tools[name] = ALL_TOOLS[name as keyof typeof ALL_TOOLS];
    }
  }

  const systemPrompt = buildSystemPrompt(enabledTools);

  // Convert messages to model format
  // UIMessages from useChat have 'parts', plain messages from embedded HTML don't
  const isUIMessageFormat = messages.length > 0 && messages[0].parts !== undefined;
  const modelMessages: ModelMessage[] = isUIMessageFormat
    ? await convertToModelMessages(messages)
    : (messages as unknown as ModelMessage[]);

  const result = streamText({
    model: azure("gpt-5-mini"),
    system: systemPrompt,
    messages: modelMessages,
    tools: Object.keys(tools).length > 0 ? tools : undefined,
    stopWhen: stepCountIs(5),
  });

  // Use UIMessage stream for useChat clients, data stream for embedded HTML clients
  if (isUIMessageFormat) {
    return result.toUIMessageStreamResponse();
  }
  return result.toTextStreamResponse();
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Workshop-Key",
    },
  });
}
