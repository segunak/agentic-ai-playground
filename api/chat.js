import { streamText, tool, stepCountIs } from "ai";
import { createAzure } from "@ai-sdk/azure";
import { z } from "zod";

export const config = { runtime: "edge" };

// ---------------------------------------------------------------------------
// Azure provider
// ---------------------------------------------------------------------------

const azure = createAzure({
  resourceName: "foundry-miscellaneous",
  apiKey: process.env.FOUNDRY_API_KEY,
});

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function executeGetWeather(city) {
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
    // Geocode the city name to lat/long
    const geoResponse = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en`
    );
    const geoData = await geoResponse.json();

    if (!geoData.results || geoData.results.length === 0) {
      return { city, error: `Could not find location: ${city}` };
    }

    const loc = geoData.results[0];
    const cityName = `${loc.name}${loc.admin1 ? ", " + loc.admin1 : ""}${loc.country ? ", " + loc.country : ""}`;

    const url =
      `https://api.open-meteo.com/v1/forecast?` +
      `latitude=${loc.latitude}&longitude=${loc.longitude}` +
      `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m` +
      `&daily=temperature_2m_max,temperature_2m_min,weather_code` +
      `&forecast_days=3` +
      `&temperature_unit=fahrenheit` +
      `&wind_speed_unit=mph`;

    const response = await fetch(url);
    const data = await response.json();
    const current = data.current;
    const daily = data.daily;

    return {
      city: cityName,
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
    return { city, error: "Could not fetch live weather data." };
  }
}

async function executeGetPeopleInSpace() {
  try {
    const response = await fetch("http://api.open-notify.org/astros.json");
    const data = await response.json();

    const byCraft = {};
    for (const person of data.people) {
      if (!byCraft[person.craft]) byCraft[person.craft] = [];
      byCraft[person.craft].push(person.name);
    }

    return {
      total: data.number,
      craft: Object.entries(byCraft).map(([craft, crew]) => ({
        craft,
        crewCount: crew.length,
        crew,
      })),
      source: "Open Notify API (open-notify.org)",
    };
  } catch {
    return { error: "Could not fetch data about people in space." };
  }
}

async function executeGetRecentEarthquakes() {
  try {
    const response = await fetch(
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson"
    );
    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      return {
        count: 0,
        message: "No significant earthquakes recorded in the past 7 days.",
        source: "USGS Earthquake Hazards Program (earthquake.usgs.gov)",
      };
    }

    return {
      count: data.features.length,
      earthquakes: data.features.slice(0, 10).map((f) => ({
        magnitude: f.properties.mag,
        location: f.properties.place,
        time: new Date(f.properties.time).toUTCString(),
        tsunami: f.properties.tsunami ? "Yes" : "No",
        url: f.properties.url,
      })),
      source: "USGS Earthquake Hazards Program (earthquake.usgs.gov)",
    };
  } catch {
    return { error: "Could not fetch earthquake data." };
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

async function executeGetNasaPictureOfTheDay() {
  try {
    const response = await fetch(
      "https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY"
    );
    const data = await response.json();
    return {
      title: data.title,
      date: data.date,
      explanation: data.explanation,
      imageUrl: data.url,
      mediaType: data.media_type,
      source: "NASA Astronomy Picture of the Day (apod.nasa.gov)",
    };
  } catch {
    return { error: "Could not fetch NASA Picture of the Day." };
  }
}

async function executeGetInternationalSpaceStationLocation() {
  try {
    const response = await fetch("http://api.open-notify.org/iss-now.json");
    const data = await response.json();
    return {
      latitude: data.iss_position.latitude,
      longitude: data.iss_position.longitude,
      timestamp: new Date(data.timestamp * 1000).toUTCString(),
      source: "Open Notify API (open-notify.org)",
    };
  } catch {
    return { error: "Could not fetch ISS location." };
  }
}

async function executeGetDadJoke() {
  try {
    const response = await fetch("https://icanhazdadjoke.com/", {
      headers: { Accept: "application/json" },
    });
    const data = await response.json();
    return { joke: data.joke, source: "icanhazdadjoke.com" };
  } catch {
    return { joke: "Why don't scientists trust atoms? Because they make up everything!", source: "Fallback joke" };
  }
}

async function executeGetDogImage() {
  try {
    const response = await fetch("https://dog.ceo/api/breeds/image/random");
    const data = await response.json();
    const breed = data.message.split("/")[4] || "unknown";
    return {
      imageUrl: data.message,
      breed: breed.replace(/-/g, " "),
      source: "Dog CEO API (dog.ceo)",
    };
  } catch {
    return { error: "Could not fetch a dog image." };
  }
}

async function executeGetTodayInHistory() {
  try {
    const response = await fetch("https://history.muffinlabs.com/date");
    const data = await response.json();
    const events = (data.data?.Events || []).slice(0, 5);
    return {
      date: data.date,
      events: events.map((e) => ({ year: e.year, text: e.text })),
      source: "History Muffin Labs API (history.muffinlabs.com)",
    };
  } catch {
    return { error: "Could not fetch today in history data." };
  }
}

// ---------------------------------------------------------------------------
// AI SDK tool definitions
// ---------------------------------------------------------------------------

const ALL_TOOLS = {
  get_weather: tool({
    description: "Gets the current weather and 3-day forecast for any city. Use when someone asks about weather, temperature, what to wear, or outdoor conditions anywhere in the world.",
    inputSchema: z.object({
      city: z.string().describe("The city name to get weather for, e.g. Charlotte, Austin, London, Tokyo"),
    }),
    execute: async ({ city }) => executeGetWeather(city),
  }),
  get_people_in_space: tool({
    description: "Gets the list of people currently in space right now, including their names and which spacecraft they are on. Use when someone asks who is in space, about astronauts, the ISS, or space stations.",
    inputSchema: z.object({}),
    execute: async () => executeGetPeopleInSpace(),
  }),
  get_recent_earthquakes: tool({
    description: "Gets significant earthquakes from the past 7 days worldwide. Use when someone asks about earthquakes, seismic activity, or natural disasters.",
    inputSchema: z.object({}),
    execute: async () => executeGetRecentEarthquakes(),
  }),
  get_charlotte_cinnamon_roll_rankings: tool({
    description: "Returns Segun Akinyemi's definitive cinnamon roll rankings for Charlotte, NC. Use when someone asks about food, bakeries, cinnamon rolls, dessert recommendations, or things to eat in Charlotte.",
    inputSchema: z.object({}),
    execute: async () => executeGetCharlotteCinnamonRollRankings(),
  }),
  get_nasa_picture_of_the_day: tool({
    description: "Gets NASA's Astronomy Picture of the Day with a title, explanation, and image URL. Use when someone asks about space photos, astronomy, or NASA.",
    inputSchema: z.object({}),
    execute: async () => executeGetNasaPictureOfTheDay(),
  }),
  get_international_space_station_location: tool({
    description: "Gets the current latitude and longitude of the International Space Station. Use when someone asks where the ISS is right now or about its position.",
    inputSchema: z.object({}),
    execute: async () => executeGetInternationalSpaceStationLocation(),
  }),
  get_dad_joke: tool({
    description: "Gets a random dad joke. Use when someone asks for a joke, wants to laugh, or needs cheering up.",
    inputSchema: z.object({}),
    execute: async () => executeGetDadJoke(),
  }),
  get_dog_image: tool({
    description: "Gets a random dog image URL with the breed name. Use when someone asks about dogs, wants to see a cute animal, or needs a pick-me-up.",
    inputSchema: z.object({}),
    execute: async () => executeGetDogImage(),
  }),
  get_today_in_history: tool({
    description: "Gets notable historical events that happened on today's date. Use when someone asks about history, what happened today, or historical trivia.",
    inputSchema: z.object({}),
    execute: async () => executeGetTodayInHistory(),
  }),
};

// ---------------------------------------------------------------------------
// Dynamic system prompt
// ---------------------------------------------------------------------------

function buildSystemPrompt(enabledToolNames, customInstructions) {
  if (enabledToolNames.length === 0 && !customInstructions) {
    return `You are a Data Assistant. You can only answer from what you learned during training. You have no tools available.

If someone asks for real-time information like current weather or recent events after your training cutoff, be honest that you're working from training data and may not have current information. Do your best to help with what you know.

Be concise, friendly, and professional.`;
  }

  const toolDescriptions = {
    get_weather: "check live weather for any city",
    get_people_in_space: "find out who is currently in space",
    get_recent_earthquakes: "check for significant recent earthquakes worldwide",
    get_charlotte_cinnamon_roll_rankings: "look up cinnamon roll rankings for Charlotte, NC",
    get_nasa_picture_of_the_day: "get NASA's Astronomy Picture of the Day",
    get_international_space_station_location: "find the current location of the International Space Station",
    get_dad_joke: "get a random dad joke",
    get_dog_image: "get a random dog image",
    get_today_in_history: "find out what happened on this day in history",
  };

  const available = enabledToolNames
    .filter((name) => toolDescriptions[name])
    .map((name) => toolDescriptions[name]);

  return `You are a Data Assistant built for the workshop "Agentic AI: From Acronyms to Applications" by Segun Akinyemi.
${customInstructions ? `\nPersonality: ${customInstructions}\n` : ""}
You have ${available.length} tool${available.length === 1 ? "" : "s"} available: ${available.join(", ")}.

Use your tools when the user's question calls for it. When sharing cinnamon roll rankings, be enthusiastic and share the hot take. Be concise, friendly, and professional.`;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function isTrustedOrigin(origin) {
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
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200 });
  }

  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  if (process.env.WORKSHOP_ACTIVE !== "true") {
    return Response.json(
      { error: "Workshop is not currently active." },
      { status: 403 }
    );
  }

  const origin = req.headers.get("origin") || "";
  const body = await req.json();

  if (!isTrustedOrigin(origin)) {
    const workshopKey =
      req.headers.get("x-workshop-key") || body?.workshopKey;
    if (!workshopKey || workshopKey !== process.env.WORKSHOP_KEY) {
      return Response.json(
        { error: "Invalid or missing workshop key." },
        { status: 401 }
      );
    }
  }

  const { messages = [], enabledTools = [], customInstructions = "" } = body;

  if (!messages.length) {
    return Response.json(
      { error: "Messages array is required." },
      { status: 400 }
    );
  }

  try {
    const tools = {};
    for (const name of enabledTools) {
      if (ALL_TOOLS[name]) {
        tools[name] = ALL_TOOLS[name];
      }
    }

    const systemPrompt = buildSystemPrompt(enabledTools, customInstructions);

    const result = streamText({
      model: azure("gpt-5-mini"),
      system: systemPrompt,
      messages,
      tools: Object.keys(tools).length > 0 ? tools : undefined,
      stopWhen: stepCountIs(5),
    });

    // Stream custom SSE from fullStream for our embedded client.
    // Events: text-delta, tool-call, tool-result, reasoning-delta, finish, error
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const part of result.fullStream) {
            let event = null;

            switch (part.type) {
              case "text-delta":
                event = { type: "text-delta", text: part.text };
                break;
              case "reasoning-delta":
                event = { type: "reasoning-delta", text: part.text };
                break;
              case "tool-call":
                event = {
                  type: "tool-call",
                  toolCallId: part.toolCallId,
                  toolName: part.toolName,
                  input: part.input,
                };
                break;
              case "tool-result":
                event = {
                  type: "tool-result",
                  toolCallId: part.toolCallId,
                  toolName: part.toolName,
                  output: part.output,
                };
                break;
              case "error":
                event = { type: "error", error: String(part.error) };
                break;
              case "finish":
                event = { type: "finish" };
                break;
              default:
                break;
            }

            if (event) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
              );
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          const errEvent = { type: "error", error: error.message };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(errEvent)}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return Response.json(
      {
        error: "Something went wrong. Please try again.",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
