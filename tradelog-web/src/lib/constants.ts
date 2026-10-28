import type { Adherence, Emotion } from "./types";

export const EMOTIONS: Emotion[] = [
  "Calm",
  "Confident",
  "Fearful",
  "Greedy",
  "Frustrated",
];

export const EMOTION_COLOR: Record<Emotion, string> = {
  Calm: "#21e0b0",
  Confident: "#5ebaff",
  Fearful: "#ff6b79",
  Greedy: "#ffc56b",
  Frustrated: "#a493f0",
};

export const ADHERENCE: Adherence[] = ["Yes", "Partially", "No"];

export const MISTAKES = [
  "None",
  "Early entry",
  "Moved stop loss",
  "Overtrading",
  "Exited too early",
  "Ignored setup rules",
];

export const TIMEFRAMES = ["5M", "15M", "1H", "4H", "Daily"];

export const DEFAULT_STRATEGIES = [
  "Liquidity sweep",
  "Trend continuation",
  "Breakout",
  "Reversal",
  "Pullback",
];

export const PAIRS = [
  "EUR/USD",
  "GBP/USD",
  "USD/JPY",
  "GBP/JPY",
  "AUD/USD",
  "USD/CAD",
  "USD/CHF",
  "NZD/USD",
  "EUR/GBP",
  "EUR/JPY",
  "XAU/USD",
];

export const DEFAULT_START_BALANCE = 10000;
