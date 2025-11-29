export const MONTHLY_THEMES = [
  { title: "The Pivot", description: "Recognizing the gap between who you are and who you want to be." },
  { title: "Detachment", description: "Letting go of the old self, the past, and what no longer serves." },
  { title: "Identity", description: "Discovering the person you are becoming underneath the layers." },
  { title: "Uncertainty", description: "Learning to trust the void and the unknown." },
  { title: "Action", description: "Making microshifts and taking small, consistent steps." },
  { title: "Boundaries", description: "Protecting your energy and choosing your environment." },
  { title: "Healing", description: "Addressing the shadows and the roots of your fears." },
  { title: "Worthiness", description: "Accepting abundance, love, and the good you deserve." },
  { title: "Purpose", description: "Finding what lights you up and aligning with your truth." },
  { title: "Presence", description: "Living in the eternal now; mindfulness as a tool." },
  { title: "Resilience", description: "Overcoming setbacks and trusting your inner mountain." },
  { title: "The Arrival", description: "Integration, reflection, and stepping into your new reality." }
];

export const PROMPT_TEMPLATES = [
  "What is one microshift you can make today to align with this theme?",
  "If you were not afraid of the outcome, what choice would you make right now?",
  "Describe the version of you that has already mastered this.",
  "What old narrative is trying to keep you small today?",
  "Where do you feel resistance in your body when you think about this?",
  "Who in your life represents this quality to you? What can you learn from them?",
  "What would you tell your younger self about this struggle?",
  "If today was the only day that mattered, how would you spend it?",
  "What are you waiting for permission to do?",
  "Write a letter to the future you who has made it through this phase.",
  "What is the most compassionate thing you can do for yourself today?",
  "How does staying in your comfort zone actually hurt you?",
  "What does your intuition whisper when the noise of the world gets quiet?",
  "Identify one thing you are holding onto that is too heavy.",
  "If your life was a story, what would the chapter title be right now?",
  "What is the gap between your actions and your desires today?",
  "How can you validate your own feelings without needing others to understand?",
  "What feels like a 'failure' that might actually be a redirection?",
  "Imagine your energy is currency. What did you spend it on today?",
  "What is one truth you are avoiding?",
  "How can you be the person you want to be, just for the next hour?",
  "What expectation can you drop today to feel lighter?",
  "Reflect on a time you pivoted before. What strength did you gain?",
  "What does 'enough' look like to you right now?",
  "If you stripped away your job and relationships, who are you?",
  "What is the most honest thing you can say to yourself today?",
  "How are you self-sabotaging? Be gentle but honest.",
  "What would it look like to trust the timing of your life completely?",
  "What is one small promise you can keep to yourself today?",
  "Breathe deeply. What does your heart need you to know?"
];

// Generate 365 prompts
export const generatePrompts = () => {
  const prompts = [];
  let dayCount = 1;

  MONTHLY_THEMES.forEach((theme, monthIndex) => {
    const daysInMonth = monthIndex === 11 ? 35 : 30; // 365 days total
    for (let i = 0; i < daysInMonth; i++) {
      const template = PROMPT_TEMPLATES[i % PROMPT_TEMPLATES.length];
      prompts.push({
        day: dayCount,
        theme: theme.title,
        themeDesc: theme.description,
        text: `Day ${dayCount}: ${theme.title}. ${template}`
      });
      dayCount++;
    }
  });
  
  prompts[0].text = "Day 1: The Pivot. Identify the gap. Where are you now, and where do you desperately want to be?";
  prompts[182].text = "Day 183: The Halfway Point. Look back at who you were on Day 1. What has shifted?";
  prompts[364].text = "Day 365: The Completion. You have lived a lifetime in a year. Who are you now?";

  return prompts;
};

export const ALL_PROMPTS = generatePrompts();
