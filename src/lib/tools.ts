export interface ToolDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export const AVAILABLE_TOOLS: ToolDefinition[] = [
  {
    id: "get_current_date",
    name: "get_current_date",
    icon: "\u{1F5D3}\u{FE0F}",
    description: "Gets the current date and time.",
  },
  {
    id: "get_charlotte_weather",
    name: "get_charlotte_weather",
    icon: "\u{1F324}\u{FE0F}",
    description: "Live weather and 3-day forecast for Charlotte, NC.",
  },
  {
    id: "get_random_fact",
    name: "get_random_fact",
    icon: "\u{1F3B2}",
    description: "Returns a random fun fact.",
  },
  {
    id: "get_charlotte_cinnamon_roll_rankings",
    name: "get_charlotte_cinnamon_roll_rankings",
    icon: "\u{1F9C1}",
    description: "Segun's cinnamon roll rankings for Charlotte, NC.",
  },
];
