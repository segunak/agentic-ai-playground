import { AzureOpenAI } from "openai";

// ---------------------------------------------------------------------------
// Tool definitions  - these are what the LLM "sees" and can choose to call
// ---------------------------------------------------------------------------

const TOOL_DEFINITIONS = {
  get_current_date: {
    type: "function",
    function: {
      name: "get_current_date",
      description:
        "Gets the current date and time. Use this when the user asks about today's date, the current time, or anything requiring knowledge of the current moment.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  get_charlotte_weather: {
    type: "function",
    function: {
      name: "get_charlotte_weather",
      description:
        "Gets the current weather and 3-day forecast for Charlotte, North Carolina. Use when someone asks about Charlotte weather, temperature, what to wear, or outdoor conditions.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  get_random_fact: {
    type: "function",
    function: {
      name: "get_random_fact",
      description:
        "Returns a random fun fact. Use when someone asks for something interesting, a fun fact, trivia, or just wants to be entertained.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  get_charlotte_cinnamon_roll_rankings: {
    type: "function",
    function: {
      name: "get_charlotte_cinnamon_roll_rankings",
      description:
        "Returns Segun Akinyemi's definitive cinnamon roll rankings for Charlotte, NC. Use when someone asks about food, bakeries, cinnamon rolls, dessert recommendations, or things to eat in Charlotte.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

function executeGetCurrentDate() {
  const now = new Date();
  return JSON.stringify({
    date: now.toISOString().split("T")[0],
    time: now.toTimeString().split(" ")[0],
    timezone: "UTC",
    formatted: now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  });
}

async function executeGetCharlotteWeather() {
  // Open-Meteo API: free, no API key, no rate limits
  // Charlotte, NC coordinates: 35.2271, -80.8431
  const url =
    "https://api.open-meteo.com/v1/forecast?" +
    "latitude=35.2271&longitude=-80.8431" +
    "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m" +
    "&daily=temperature_2m_max,temperature_2m_min,weather_code" +
    "&forecast_days=3" +
    "&temperature_unit=fahrenheit" +
    "&wind_speed_unit=mph";

  try {
    const response = await fetch(url);
    const data = await response.json();

    const weatherCodes = {
      0: "Clear sky",
      1: "Mainly clear",
      2: "Partly cloudy",
      3: "Overcast",
      45: "Foggy",
      48: "Depositing rime fog",
      51: "Light drizzle",
      53: "Moderate drizzle",
      55: "Dense drizzle",
      61: "Slight rain",
      63: "Moderate rain",
      65: "Heavy rain",
      71: "Slight snow",
      73: "Moderate snow",
      75: "Heavy snow",
      80: "Slight rain showers",
      81: "Moderate rain showers",
      82: "Violent rain showers",
      95: "Thunderstorm",
      96: "Thunderstorm with slight hail",
      99: "Thunderstorm with heavy hail",
    };

    const current = data.current;
    const daily = data.daily;

    const forecast = daily.time.map((date, i) => ({
      date: date,
      high: `${daily.temperature_2m_max[i]}F`,
      low: `${daily.temperature_2m_min[i]}F`,
      conditions: weatherCodes[daily.weather_code[i]] || `Code ${daily.weather_code[i]}`,
    }));

    return JSON.stringify({
      city: "Charlotte, NC",
      current: {
        temperature: `${current.temperature_2m}F`,
        feels_like: `${current.apparent_temperature}F`,
        conditions: weatherCodes[current.weather_code] || `Code ${current.weather_code}`,
        humidity: `${current.relative_humidity_2m}%`,
        wind: `${current.wind_speed_10m} mph`,
      },
      forecast: forecast,
      source: "Open-Meteo API (open-meteo.com)",
    });
  } catch (error) {
    return JSON.stringify({
      city: "Charlotte, NC",
      error: "Could not fetch live weather data.",
      fallback: "Charlotte typically has mild weather. Check weather.com for current conditions.",
    });
  }
}

async function executeGetRandomFact() {
  try {
    const response = await fetch("https://uselessfacts.jsph.pl/api/v2/facts/random?language=en");
    const data = await response.json();
    return JSON.stringify({
      fact: data.text,
      source: data.source,
      source_url: data.source_url,
    });
  } catch (error) {
    return JSON.stringify({
      fact: "A group of flamingos is called a 'flamboyance'.",
      source: "Fallback fact",
      note: "Could not reach the fun facts API, so here's one from memory.",
    });
  }
}

function executeGetCharlotteCinnamonRollRankings() {
  return JSON.stringify({
    source: "Segun Akinyemi's Personal Rankings",
    city: "Charlotte, NC",
    last_updated: "2026",
    rankings: [
      {
        rank: 1,
        name: "Honeybear Bake Shop",
        note: "Available at Mattie Ruth's Coffee in Concord, otherwise order for pickup only  - no walk-in storefront. The best cinnamon rolls in Charlotte, period.",
      },
      {
        rank: 2,
        name: "Sunflour Bakery",
        note: "Tied for #2. A Charlotte staple.",
      },
      {
        rank: 2,
        name: "Beyond Amazing Donuts",
        note: "Tied for #2. Don't let the name fool you  - their cinnamon rolls are incredible.",
      },
      {
        rank: 3,
        name: "The Batch House",
        note: "Consistently excellent.",
      },
      {
        rank: 4,
        name: "Knowledge Perk Coffee",
        note: "A coffee shop that bakes their own cinnamon rolls in house. Hidden gem.",
      },
      {
        rank: 5,
        name: "Sugar Donuts",
        note: "Also a great spot to buy cinnamon rolls in bulk.",
      },
      {
        rank: 6,
        name: "Cinnaholic",
        note: "Located in Concord. Think Chipotle but for cinnamon rolls  - build your own.",
      },
      {
        rank: 7,
        name: "The Salty Donut",
        note: "Great cinnamon rolls but very expensive.",
      },
    ],
    hot_take:
      "Amelie's French Bakery and Cafe has some of the worst cinnamon rolls in Charlotte. And nationwide chains like Panera Bread and Cinnabon don't count. Cinnabon specifically is a soupy mess  - quantity does not equate to quality. They just drown their cinnamon rolls in icing. Cinnabon is the McDonald's of cinnamon rolls. Most people went to the mall growing up and that's the only cinnamon rolls they had, so they think they're good. They're not. Expand your horizons.",
    disclaimer:
      "These are the personal opinions of Segun Akinyemi, workshop facilitator and cinnamon roll enthusiast. Your mileage may vary.",
  });
}

// Map tool names to their execution functions
const TOOL_EXECUTORS = {
  get_current_date: () => executeGetCurrentDate(),
  get_charlotte_weather: () => executeGetCharlotteWeather(),
  get_random_fact: () => executeGetRandomFact(),
  get_charlotte_cinnamon_roll_rankings: () => executeGetCharlotteCinnamonRollRankings(),
};

// ---------------------------------------------------------------------------
// System prompt - dynamically built based on which tools are enabled
// ---------------------------------------------------------------------------

function buildSystemPrompt(enabledToolNames) {
  if (enabledToolNames.length === 0) {
    return `You are a Data Assistant. You can only answer from what you learned during training. You have no tools available.

If someone asks for real-time information like today's date or current weather, be honest that you're working from training data and may not have current information. Do your best to help with what you know.

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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Kill switch - flip WORKSHOP_ACTIVE to "false" in Vercel to shut everything down
  if (process.env.WORKSHOP_ACTIVE !== "true") {
    return res.status(403).json({ error: "Workshop is not currently active." });
  }

  // Check if the request comes from a trusted origin (e.g. VS Code for Education)
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

  // Validate workshop key unless the request is from a trusted origin
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
    // Build the Microsoft Foundry client
    const client = new AzureOpenAI({
      endpoint: "https://foundry-miscellaneous.cognitiveservices.azure.com/",
      apiKey: process.env.FOUNDRY_API_KEY,
      apiVersion: "2024-05-01-preview",
    });

    // Build tool list based on what's enabled
    const tools = enabledTools
      .filter((name) => TOOL_DEFINITIONS[name])
      .map((name) => TOOL_DEFINITIONS[name]);

    // Build the conversation with a dynamic system prompt
    const systemPrompt = buildSystemPrompt(enabledTools);
    const conversationMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // Reasoning trace for the UI
    const reasoning = [];
    reasoning.push({ type: "thinking", content: "Processing your message..." });

    // Tool-calling loop  - max 10 iterations to prevent runaway
    const MAX_ITERATIONS = 10;
    let iteration = 0;

    while (iteration < MAX_ITERATIONS) {
      iteration++;

      const completionParams = {
        model: "gpt-5-mini",
        messages: conversationMessages,
        max_completion_tokens: 1024,
      };

      // Only include tools if any are enabled
      if (tools.length > 0) {
        completionParams.tools = tools;
        completionParams.tool_choice = "auto";
      }

      const completion = await client.chat.completions.create(completionParams);
      const choice = completion.choices[0];

      // If the model wants to call tools
      if (choice.finish_reason === "tool_calls" || choice.message.tool_calls) {
        // Add the assistant message with tool calls to conversation
        conversationMessages.push(choice.message);

        // Execute each tool call
        for (const toolCall of choice.message.tool_calls) {
          const fnName = toolCall.function.name;
          let fnArgs = {};

          try {
            fnArgs = JSON.parse(toolCall.function.arguments || "{}");
          } catch {
            fnArgs = {};
          }

          reasoning.push({
            type: "tool_call",
            tool: fnName,
            args: fnArgs,
          });

          // Execute the tool
          const executor = TOOL_EXECUTORS[fnName];
          let result;

          if (executor) {
            result = await executor(fnArgs);
          } else {
            result = JSON.stringify({
              error: `Unknown tool: ${fnName}`,
            });
          }

          reasoning.push({
            type: "tool_result",
            tool: fnName,
            result: JSON.parse(result),
          });

          // Add tool result to conversation
          conversationMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result,
          });
        }

        reasoning.push({
          type: "thinking",
          content: "Analyzing tool results...",
        });

        // Continue the loop  - model will process tool results
        continue;
      }

      // Model returned a final text response  - we're done
      const responseText = choice.message.content;

      // Reasoning models sometimes return empty content. Retry once.
      if (!responseText && iteration < MAX_ITERATIONS) {
        reasoning.push({ type: "thinking", content: "Generating response..." });
        continue;
      }

      const finalText = responseText || "I'm not sure how to respond to that. Could you try rephrasing?";
      reasoning.push({ type: "response", content: finalText });

      return res.status(200).json({
        response: finalText,
        reasoning: reasoning,
      });
    }

    // Safety fallback if we hit max iterations
    reasoning.push({
      type: "response",
      content: "I've completed my analysis. Let me know if you have other questions!",
    });

    return res.status(200).json({
      response: "I've completed my analysis. Let me know if you have other questions!",
      reasoning: reasoning,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return res.status(500).json({
      error: "Something went wrong. Please try again.",
      details: error.message,
    });
  }
}
