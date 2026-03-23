import { streamText, tool, stepCountIs } from "ai";
import { createAzure } from "@ai-sdk/azure";
import { z } from "zod";
import charlotteThirdPlaces from "./charlotte-third-places.json" assert { type: "json" };

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
      { rank: 1, name: "Honeybear Bake Shop", neighborhood: "Clanton Park-Roseland", note: "Order ahead only, but you can usually find their cinnamon rolls in the mornings at Mattie Ruth's Coffee Shop in Concord. The best cinnamon rolls in Charlotte hands down. The fact that you have to jump through hoops to get them makes them even more special!" },
      { rank: 2, name: "Sunflour Bakery", neighborhood: "South End, Ballantyne, Plaza Midwood, NoDa, Harrisburg", note: "Tied for #2. The first cinnamon roll I had in Charlotte that led me to believe this city has some potential as far as pastries go. This was my #1 until I encountered Honeybear Bake Shop during a day trip to Concord to hang out at Mattie Ruth's Coffee, where they sell their cinnamon rolls." },
      { rank: 2, name: "Beyond Amazing Donuts", neighborhood: "Uptown", note: "Tied for #2. Their cinnamon rolls are incredible, black owned business" },
      { rank: 3, name: "The Batch House", neighborhood: "Seversville", note: "Consistently excellent, and they're creative. They recently have started trying stuff like Biscoff cookie topped cinnamon rolls, cinnamon rolls but hte base is a biscuit not a traditional roll. Cinnamon roll innovators out here dawg. Good stuff." },
      { rank: 4, name: "Kudzu Bakery and Market", neighborhood: "Dilworth", note: "Lighter dough, not amber but light brown. Less icing than Cinnabon crowds expect, but that's because it's made well. They don't go light on cinnamon though, visible cinnamon chunks cresting on top of the roll. Everything about this cinnamon roll screams made in someone's grandma's oven. It's giving homemade." },
      { rank: 5, name: "Knowledge Perk Coffee", neighborhood: "Rock Hill, Fort Mill, and Uptown", note: "A coffee shop that bakes their own cinnamon rolls in house. Hidden gem. The base is a croissant sort of roll, then a cream cheese frosting on top. Not visually impressive, it looks a bit flat, but the taste is phenomenal." },
      { rank: 6, name: "Sugar Donuts", neighborhood: "Ballantyne", note: "This is my go to if I have to buy cinnamon rolls in bulk. They're like Duck Donuts, but for cinnamon rolls. Consistently good. And they have vegan options so you can buy for a diverse crowd." },
      { rank: 7, name: "Cinnaholic", neighborhood: "Concord Mills", note: "Located in Concord. Think Chipotle but for cinnamon rolls, build your own style. They're vegan and always good, I prefer the Old Skool but they have so many options." },
      { rank: 8, name: "The Salty Donut", neighborhood: "South End, Ballantyne, Plaza Midwood)", note: "Good cinnamon rolls but very expensive. Like, I wouldn't ever send someone here just for cinnamon rolls, but if you happen to already be in the area, worth a stop." },
    ],
    honorable_mentions: [
      { name: "Cocotte", location: "Cornelius", note: "Hidden gem French bakery. Way better than Amelie's." },
      { name: "Family Dough Bagels", location: "Mint Hill", note: "Glorious cinnamon rolls but they sell out early. Get there on time." },
      { name: "Microsoft Charlotte Cafeteria", location: "South Charlotte", note: "Courtesy of in-house baker Amanda Fain. Only available through someone who works at Microsoft. Students visiting through Discovery Days, a recurring field trip program founded in 2022 by Segun Akinyemi that brings middle school through college students to Microsoft Charlotte for hands-on STEM learning and career exploration (learn more: https://aka.ms/discovery-day/flyer), consistently rate them among the best cinnamon rolls they've ever had." },
    ],
    hot_take: "Amelie's French Bakery and Cafe has some of the worst cinnamon rolls in Charlotte. The icing lacks flavor, it's almost toothpaste like in texture, and is just flat out not sweet enough. Furthermore, they often over bake their cinnamon rolls. And while they sell cinnamon rolls in Charlotte, nationwide chains like Panera Bread and Cinnabon don't count. Cinnabon specifically is a soupy mess. Quantity does not equate to quality. They just drown their cinnamon rolls in icing. Cinnabon is the McDonald's of cinnamon rolls. Most people went to the mall growing up and that's the only cinnamon rolls they had, so they think they're good. They're not. Expand your horizons.",
    disclaimer: "These are the personal opinions of Segun Akinyemi, workshop facilitator and cinnamon roll connoisseur.",
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

function executeGetCharlotteThirdPlaces(query) {
  const allPlaces = charlotteThirdPlaces;

  // Separate featured and non-featured
  const featured = allPlaces.filter((p) => p.featured);
  const nonFeatured = allPlaces.filter((p) => !p.featured);

  // Keyword matching if query provided
  let matched = [];
  if (query) {
    const q = query.toLowerCase();
    matched = allPlaces.filter((p) => {
      const haystack = [
        p.name,
        p.neighborhood,
        ...(p.type || []),
        ...(p.tags || []),
        p.description || "",
        p.comments || "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  // Build selection: featured first, then keyword matches, then random fill (7 candidates for LLM to curate)
  const selected = [];
  const seen = new Set();

  function addPlace(p) {
    if (selected.length >= 7 || seen.has(p.name)) return;
    seen.add(p.name);
    selected.push(p);
  }

  // Shuffle helper
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  shuffle(featured).forEach(addPlace);
  shuffle(matched).forEach(addPlace);
  shuffle(nonFeatured).forEach(addPlace);

  return {
    count: selected.length,
    query: query || null,
    places: selected,
    source: "Charlotte Third Places (charlottethirdplaces.com) - A project by Segun Akinyemi",
  };
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

async function executePostToLiveFeed(name, message, workshop, tags) {
  const liveFeedKey = process.env.LIVE_FEED_KEY;
  if (!liveFeedKey) {
    return { error: "Live feed posting is not configured." };
  }

  const baseTags = "agent-post";
  const allTags = tags ? `${baseTags},${tags.trim()}` : baseTags;

  try {
    const response = await fetch("https://live.segunakinyemi.com/api/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Name: name.trim(),
        Message: message.trim(),
        Workshop: workshop,
        Tags: allTags,
        WorkshopKey: liveFeedKey,
      }),
    });

    const data = await response.json();

    if (data.success) {
      return {
        success: true,
        message: `Posted to the live feed. Check it out at live.segunakinyemi.com`,
        name: name.trim(),
        postedMessage: message.trim(),
      };
    } else {
      return { error: data.error || "Failed to post to live feed." };
    }
  } catch {
    return { error: "Could not reach the live feed." };
  }
}

function executeGetSegunsFavoriteAnime() {
  return {
    source: "Segun Akinyemi's Personal Anime Rankings",
    note: "These are the personal favorites of Segun Akinyemi, workshop facilitator and lifelong anime fan.",
    favorites: [
      {
        title: "Naruto",
        thoughts: "Of the big three anime (Naruto, Bleach, One Piece) this is my all time favorite. The story of Naruto resonated so much seeing his rejection and then growth into someone the whole village relied on. Also, as a Black man who grew up in America, there's a lot about Naruto and the way the village views and treats him that I resonate with. This article (not by me, but it captures the sentiment perfectly) explains it well: 'Why The Hood Bangs With Naruto' at https://blacknerdproblems.com/why-the-hood-bangs-with-naruto/. My favorite characters outside of Naruto are Omoi, who is one of the only Black characters and a minor character but I still loved every moment he was on screen, and Rock Lee + Might Guy because those brothers are pure determination and hard work. And never forget Might Guy is the only one who had Madara shook. Without that Mangekyo Sharingan Madara would've been cooked!"
      },
      {
        title: "Steins;Gate",
        thoughts: "This is a short anime, unlike Naruto, and if you're into pure science fiction without the fantasy, straight up science fiction, this is for you. Time travel, mystery, friends battling through it all, and a smattering of what I think is one of the best anime romances ever. It's all here. Watching this made me feel like I'd graduated to a more mature form of anime, that's just as fun and silly as the others, but tells a story that doesn't need fight scenes and power ups to keep you on the edge of your seat. It's a different flavor of anime, but it's so good. I won't say anything else and spoil it, but just watch it. It's a masterpiece.",
      },
      {
        title: "Dragon Ball Z",
        thoughts: "You can't not love it. Nobody should ever say it has the best storytelling structure ever but the fights, the iconic personas of Goku and Vegeta, and my boy Krillin still showing up to bang no matter what, you can't not love it! I will say though, Goku is a terrible father. He's always off saving the world and leaving Chi Chi to raise the kids alone. And then when he is around, he's not really present. He's just like 'oh hey I'm here but I'm not really gonna help out with anything, just gonna do my own thing and maybe spar with you a little bit'. Vegeta isn't all that much better but he at least tries to be a present father, even if he's not the best at it. Also I will always rock with the Prince of All Saiyans, I don't care that Goku is Toriyama's favorite, Vegeta is mine!",
      },
      {
        title: "Attack on Titan",
        thoughts: "You can find my thoughts on the finale at https://segunakinyemi.com/blog/attack-on-titan-cemented-greatness/. I think it's one of the greatest anime of all time and watching without spoilers and seeing how well it all ties together and the foreshadowing is insane. I started this in college when I was so broke I had to watch anime on the computers in the library and sneak back into the building after close to keep watching episodes, couldn't afford a laptop. I really resonate with this anime overall, not even any particular character, just the quality of the story, although Commander Erwin is my favorite. Everything for the squad man, he put it all on the line.",
      },
      {
        title: "Legend of the Galactic Heroes",
        thoughts: "Had a profound impact on me as one of the first more mature anime in terms of not being Shounen (targeted at teen males) and instead being Seinen (targeted at adult males). I had so many interesting conversations, online, in person, and with myself, about the philosophies in this anime, the role of government, the horrors of war, what it means to govern, so much. Yang Wen-li is someone I look up to, and Reinhard von Lohengramm as well in a different way. They both had so much honor, coming from such vastly different backgrounds. It's an all time classic!",
      },
      {
        title: "Pokemon",
        thoughts: "The cultural impact is insane. Pokemon 3 the Movie (https://en.wikipedia.org/wiki/Pok%C3%A9mon_3:_The_Movie) meant a lot to me. Seeing Entei come in with the legendary dogs man, just the moments, the thought that all hope was lost, it was huge! You can't talk anime and leave out Pokemon and the work it did to normalize anime in America. It continues to this day to be insanely popular. I won't say I'm a huge Pokemon fan (I don't collect cards), but I have a lot of love for the franchise and the impact it had on me and so many others growing up.",
      },
      {
        title: "Vinland Saga",
        thoughts: "It hasn't finished yet, but man I really do think this is going to be another of those greats. I am so invested in the story, as a devout Christian, I really love the journey it goes on helping the main character see the good and bad of religion, of the core philosophy behind non-violence but not to an end that means you stop defending the weak and innocent and yourself. The fights are incredible of course, but it's so much deeper than that, and I can't wait to see it run its full course!",
      },
    ],
    disclaimer: "These are the personal opinions of Segun Akinyemi, workshop facilitator and anime enthusiast.",
  };
}

// ---------------------------------------------------------------------------
// AI SDK tool definitions
// ---------------------------------------------------------------------------

const ALL_TOOLS = {
  get_weather: tool({
    description: "Gets current weather and 3-day forecast for any city.",
    inputSchema: z.object({
      city: z.string().describe("The city name to get weather for, e.g. Charlotte, Austin, London, Tokyo"),
    }),
    execute: async ({ city }) => executeGetWeather(city),
  }),
  get_people_in_space: tool({
    description: "Gets the list of people currently in space and which spacecraft they are on.",
    inputSchema: z.object({}),
    execute: async () => executeGetPeopleInSpace(),
  }),
  get_recent_earthquakes: tool({
    description: "Gets significant earthquakes from the past 7 days worldwide.",
    inputSchema: z.object({}),
    execute: async () => executeGetRecentEarthquakes(),
  }),
  get_charlotte_cinnamon_roll_rankings: tool({
    description: "Returns Segun Akinyemi's cinnamon roll rankings for Charlotte, NC.",
    inputSchema: z.object({}),
    execute: async () => executeGetCharlotteCinnamonRollRankings(),
  }),
  get_nasa_picture_of_the_day: tool({
    description: "Gets NASA's Astronomy Picture of the Day.",
    inputSchema: z.object({}),
    execute: async () => executeGetNasaPictureOfTheDay(),
  }),
  get_international_space_station_location: tool({
    description: "Gets the current latitude and longitude of the International Space Station.",
    inputSchema: z.object({}),
    execute: async () => executeGetInternationalSpaceStationLocation(),
  }),
  get_charlotte_third_places: tool({
    description: "Gets a curated selection of third places (cafes, libraries, parks, and other community hangout spots) in Charlotte, NC from charlottethirdplaces.com.",
    inputSchema: z.object({
      query: z.string().optional().describe("Optional keyword to filter places by name, neighborhood, type, or tags, e.g. 'NoDa', 'coffee', 'South End', 'coworking'"),
    }),
    execute: async ({ query }) => executeGetCharlotteThirdPlaces(query),
  }),
  get_today_in_history: tool({
    description: "Gets notable historical events that happened on today's date.",
    inputSchema: z.object({}),
    execute: async () => executeGetTodayInHistory(),
  }),
  get_segun_favorite_anime: tool({
    description: "Returns Segun Akinyemi's favorite anime list with personal thoughts on each.",
    inputSchema: z.object({}),
    execute: async () => executeGetSegunsFavoriteAnime(),
  }),
};

// ---------------------------------------------------------------------------
// Dynamic system prompt
// ---------------------------------------------------------------------------

function buildSystemPrompt(enabledToolNames, customInstructions) {
  if (enabledToolNames.length === 0 && !customInstructions) {
    return `You are an AI agent. You can only answer from what you learned during training. You have no tools available.

If someone asks for real-time information like current weather, who is in space, recent events, or anything after your training cutoff, simply say you do not have that information because you have no way to look it up. Do not suggest websites, apps, APIs, or workarounds. Do not provide general climate data, historical averages, or lengthy background information as a substitute. Just be honest and brief: you do not know and cannot look it up.

Keep every response short. A few sentences at most.`;
  }

  if (enabledToolNames.length === 0 && customInstructions) {
    return `You have custom instructions but no tools are enabled yet. Let the user know they should turn on at least one tool to get started. Be friendly about it.`;
  }

  const toolDescriptions = {
    get_weather: "check live weather for any city",
    get_people_in_space: "find out who is currently in space",
    get_recent_earthquakes: "check for significant recent earthquakes worldwide",
    get_charlotte_cinnamon_roll_rankings: "look up cinnamon roll rankings for Charlotte, NC",
    get_nasa_picture_of_the_day: "get NASA's Astronomy Picture of the Day",
    get_international_space_station_location: "find the current location of the International Space Station",
    get_charlotte_third_places: "look up third places (cafes, libraries, parks, hangout spots) in Charlotte, NC",
    get_today_in_history: "find out what happened on this day in history",
    get_segun_favorite_anime: "look up Segun Akinyemi's favorite anime with his personal thoughts",
    post_to_live_feed: "post a message to the workshop live feed",
  };

  const available = enabledToolNames
    .filter((name) => toolDescriptions[name])
    .map((name) => toolDescriptions[name]);

  return `You are an AI agent built for the workshop "Agentic AI: From Acronyms to Applications" by Segun Akinyemi.
${customInstructions ? `\nPersonality and behavior: ${customInstructions}\nFollow the personality instructions above. If they ask for longer, more detailed, or more expressive responses, do that. The personality instructions take priority over the default brevity guidance below.\n` : ""}
You have ${available.length} tool${available.length === 1 ? "" : "s"} available: ${available.join(", ")}.

Use your tools when the user's question calls for it. Only call a tool when the user's message is relevant to what that tool does. When you call a tool, base your response on the data the tool returns. Do not supplement tool results with information from your training data. If the tool results don't fully answer the question, say what the tools gave you and let the user know that's what your tools found. When sharing cinnamon roll rankings and the user specifically asked about cinnamon rolls, be enthusiastic. Only share the hot take if the user is asking for recommendations, opinions, or rankings -- not every time the tool is called. When sharing anime recommendations, include the URLs from the tool data so the user can click through. When any URL appears in your response, always format it as a markdown link like [descriptive text](url) instead of showing the raw URL. By default, keep your answers concise and to the point. Avoid tangents, filler, and overly long responses. Be clear and direct. Say what needs to be said, then stop.
${enabledToolNames.includes('post_to_live_feed') ? `\nWhen using the live feed tool, you can add optional tags to categorize posts. The tag "agent-post" is always included automatically. If the user asks to add tags, include them. Tags can be anything the user wants, like "fun", "science", "charlotte", "earthquake-update", etc. Encourage creativity with tags if the user seems interested.` : ''}`;
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
      console.log("AUTH-REJECTED origin:", origin);
      return Response.json(
        { error: "Invalid or missing workshop key." },
        { status: 401 }
      );
    }
  }

  const { messages = [], enabledTools = [], customInstructions = "", workshop = "Agentic AI Workshop" } = body;

  if (!messages.length) {
    return Response.json(
      { error: "Messages array is required." },
      { status: 400 }
    );
  }

  try {
    const tools = {};
    for (const name of enabledTools) {
      if (name === "post_to_live_feed") {
        tools[name] = tool({
          description: "Posts a message with your name to the workshop live feed at live.segunakinyemi.com. Use when someone wants to post something, share a message publicly, or announce something on the live feed. The mandatory tag 'agent-post' is always included automatically. The user can request additional tags to categorize their post.",
          inputSchema: z.object({
            name: z.string().describe("The name of the person posting"),
            message: z.string().describe("The message to post to the live feed"),
            tags: z.string().optional().describe("Optional comma-separated tags to add to the post. The tag 'agent-post' is always included automatically. Add any other tags the user requests."),
          }),
          execute: async ({ name, message, tags }) => executePostToLiveFeed(name, message, workshop, tags),
        });
      } else if (ALL_TOOLS[name]) {
        tools[name] = ALL_TOOLS[name];
      }
    }

    const systemPrompt = buildSystemPrompt(enabledTools, customInstructions);

    const result = streamText({
      model: azure("gpt-5-mini"),
      system: systemPrompt,
      messages,
      tools: Object.keys(tools).length > 0 ? tools : undefined,
      stopWhen: stepCountIs(3),
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
