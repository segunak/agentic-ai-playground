// Quick API verification for the 4 new keyless tools.
// Run with: node tools/test_tools.js

const tests = [
  {
    name: "Wikipedia Lookup",
    url: "https://en.wikipedia.org/w/api.php?action=query&titles=Charlotte%2C_North_Carolina&prop=extracts&exintro=true&explaintext=true&format=json&redirects=1",
    validate: (data) => {
      const pages = data.query?.pages;
      const page = Object.values(pages)[0];
      return page && page.extract && page.extract.length > 0;
    },
  },
  {
    name: "DuckDuckGo Instant Answers",
    url: "https://api.duckduckgo.com/?q=Charlotte+North+Carolina&format=json&no_html=1&skip_disambig=1",
    validate: (data) => {
      return data.Heading || data.AbstractText || (data.RelatedTopics && data.RelatedTopics.length > 0);
    },
  },
  {
    name: "REST Countries",
    url: "https://restcountries.com/v3.1/name/japan?fields=name,capital,population,languages,currencies,region,subregion,flags,area",
    validate: (data) => {
      return Array.isArray(data) && data[0]?.name?.common === "Japan" && data[0]?.population > 0;
    },
  },
  {
    name: "World Bank Data (GDP for Japan)",
    url: "https://api.worldbank.org/v2/country/JPN/indicator/NY.GDP.MKTP.CD?format=json&date=2020:2024&per_page=5",
    validate: (data) => {
      return Array.isArray(data) && data.length === 2 && Array.isArray(data[1]) && data[1].length > 0 && data[1][0].value !== null;
    },
  },
  {
    name: "REST Countries → ISO Code Resolution (for World Bank)",
    url: "https://restcountries.com/v3.1/name/brazil?fields=cca3,name",
    validate: (data) => {
      return Array.isArray(data) && data[0]?.cca3 === "BRA";
    },
  },
];

async function runTests() {
  console.log("Testing 4 new tool APIs...\n");
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const response = await fetch(test.url);
      if (!response.ok) {
        console.log(`  FAIL  ${test.name} — HTTP ${response.status}`);
        failed++;
        continue;
      }
      const data = await response.json();
      if (test.validate(data)) {
        console.log(`  PASS  ${test.name}`);
        passed++;
      } else {
        console.log(`  FAIL  ${test.name} — Unexpected response shape`);
        failed++;
      }
    } catch (err) {
      console.log(`  FAIL  ${test.name} — ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length} tests`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
