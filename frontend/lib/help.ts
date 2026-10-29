export const PAGE_DESCRIPTIONS = {
  emergencyFit:
    "In a hurry? Answer a few quick questions and Nemotron Nano builds a wearable outfit from the clothes you have marked available.",
  rescue: "One piece isn't working? Swap just that piece — everything else in the outfit stays locked.",
  stylist:
    "Ask in your own words — a wedding, a beach picnic, a first day at work — and Nemotron Super styles an outfit from your wardrobe and explains why it works.",
  trends:
    "What is being worn right now, from live fashion sources. Nemotron Ultra turns them into one outfit idea; sources and dates are always shown, and prices are never invented.",
  wardrobe:
    "Everything you own, in one place. Mark each piece available, in laundry, or packed away — Vastra only styles what is available.",
  looks: "Outfits you have saved from Emergency Fit, Rescue, and Stylist chat, ready to wear again.",
  events: "Occasions you are planning outfits for, kept in one list.",
  dictionary:
    "Plain-language definitions for garments, fabrics, and styling ideas across Indian, Western, and fusion styles. Tip: tap “What’s this?” on any item name, anywhere in the app.",
  preferences:
    "The style preferences you have confirmed. Emergency Fit, Rescue, and Stylist chat use them as guidance.",
  profile:
    "Your style lanes and tastes. Emergency Fit, Rescue, and Stylist chat use this profile as guidance when you have saved one.",
} as const;

export const HELP_TITLE = "How Vastra works";

export const HELP_SECTIONS = [
  {
    title: "Why “Vastra”?",
    body: "Vastra (वस्त्र) is the Sanskrit word for clothing. The name is the idea: your own clothes, treated with care.",
  },
  {
    title: "What Vastra is",
    body: "An AI stylist for Indian, Western, and fusion wardrobes, for formal and informal occasions alike. It suggests outfits based on your style profile, your confirmed preferences, and your taste — and if you want to improve how you dress, it explains why each outfit works and teaches the words for styles as you go (see the Style Dictionary).",
  },
  {
    title: "The one rule",
    body: "Vastra only ever styles clothes you own and have marked available. It never invents an item, a price, or a shopping link. The one place outside information appears is Trend Stylist, and there the sources and their dates are always shown.",
  },
  {
    title: "Start in 30 seconds (demo)",
    body: "Tap “Try the demo” → open Emergency Fit → generate an outfit. No sign-up, no typing a wardrobe.",
  },
  {
    title: "Each flow, step by step",
    body: "Emergency Fit: answer a few questions → generate → save or rescue. Rescue: pick the piece to change → swap it → save. Stylist chat: type any occasion → read the outfit and why it works → save when the look is made only from saved pieces. Trend Stylist: enter occasion, vibe, and budget → read the idea → check its sources. Wardrobe: add pieces → set availability → keep it current. Dictionary: browse by kind or style lane, or tap “What’s this?” on any item.",
  },
  {
    title: "Which model does what",
    body: "Emergency Fit and Rescue use Nemotron Nano for fast answers; Stylist chat uses Nemotron Super for conversation; Trend Stylist uses Nemotron Ultra for deeper reasoning over live sources. All run on Nebius Token Factory.",
  },
  {
    title: "Good to know",
    body: "Mark laundry honestly and Vastra will never style a piece you cannot wear today. Demo data is synthetic and clearly labelled. Vastra does not sell anything and does not send you to a store.",
  },
] as const;
