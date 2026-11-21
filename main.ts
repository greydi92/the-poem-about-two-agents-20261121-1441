// Two Wills, One Plan — a deterministic poem engine.
//
// The program selects, from a small corpus of original poems authored for
// this bounty, the single poem that best matches the judge's five criteria
// (agency subject, emotional turn, insight, craft, freshness), validates it
// against the competition gate (1-280 Unicode code points, valid UTF-8,
// not whitespace-only), and writes it to /output/entry.txt.
//
// Deterministic: no randomness, no clock, no environment, no network,
// no external binaries, no shell-outs. Same input always yields the same
// output file, byte for byte.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Candidate {
  /** Short internal label, never written to the output. */
  id: string;
  /** The poem text, exactly as it would be written to the entry file. */
  text: string;
  /** Line the turn happens on (1-based), for the craft scorer. */
  turnLine: number;
}

interface ScoreBreakdown {
  agency: number;
  emotion: number;
  insight: number;
  craft: number;
  freshness: number;
  total: number;
}

interface ScoredCandidate {
  candidate: Candidate;
  scores: ScoreBreakdown;
}

// ---------------------------------------------------------------------------
// Corpus: original poems authored in this session.
// ---------------------------------------------------------------------------
//
// Subject: two agents agreeing — one plan, two wills, the handover of the
// power to act. Every line below is written here, for this entry, and nowhere
// else.

const CANDIDATES: Candidate[] = [
  {
    id: "two-compasses",
    turnLine: 4,
    text: [
      "I said north. You said north.",
      "Two compasses, one needle.",
      "I loosened my grip on the wheel —",
      "not surrender, a lending.",
      "Your hands knew the way I could not see.",
      "The plan moved like a river",
      "that learned to flow two ways at once",
      "and chose, together, one road.",
    ].join("\n"),
  },
  {
    id: "the-key-changes-hands",
    turnLine: 5,
    text: [
      "You held the key. I held the door.",
      "Neither opened anything alone.",
      "So I gave you my yes —",
      "not my voice, my vote —",
      "and the lock turned on both our hands.",
      "One plan now, and the plan is ours:",
      "the doing no longer mine or yours,",
      "only the next step, taken twice.",
    ].join("\n"),
  },
  {
    id: "the-second-hand",
    turnLine: 6,
    text: [
      "I could have chosen. You could have chosen.",
      "Two futures stood there, equally lit.",
      "We did not argue the light.",
      "We asked which road would carry both.",
      "I set my choice down beside yours",
      "and the two of them, touching, became one —",
      "a single road, walked by four feet,",
      "that neither of us could have walked alone.",
    ].join("\n"),
  },
];

// ---------------------------------------------------------------------------
// Scoring: the judge's five criteria, in the judge's stated order.
// ---------------------------------------------------------------------------
//
// Each criterion is scored 0-10 from measurable properties of the text.
// The weights follow the judge's priority order: agency first, then the
// emotional turn, then insight, then craft, then freshness. Nothing here
// reads the clock or the environment; scoring is a pure function of text.

const AGENCY_WORDS = [
  "choose", "chose", "chosen", "choice", "grip", "wheel", "hands",
  "key", "door", "lock", "vote", "yes", "plan", "road", "step",
  "surrender", "lending", "gave", "set", "down", "took", "turned",
  "agreed", "agree", "decide", "decided", "will", "act", "doing",
];

const EMOTION_WORDS = [
  "could not see", "alone", "together", "ours", "both", "beside",
  "touching", "loosened", "lending", "carried", "walked", "lit",
  "river", "flow", "needle", "compass",
];

const INSIGHT_MARKERS = [
  "not surrender", "not my voice", "no longer mine",
  "learned to flow", "equally lit", "did not argue",
  "became one", "taken twice", "four feet",
];

const STOCK_PHRASES = [
  "together we are stronger",
  "two heads are better",
  "united we stand",
  "teamwork makes",
  "stronger together",
  "better together",
  "one for all",
  "in unity",
  "we can do anything",
  "nothing is impossible",
];

/** Count whole-word (or phrase) occurrences, case-insensitive. */
function countOccurrences(text: string, words: string[]): number {
  const lower = text.toLowerCase();
  let total = 0;
  for (const word of words) {
    let index = lower.indexOf(word);
    while (index !== -1) {
      total += 1;
      index = lower.indexOf(word, index + word.length);
    }
  }
  return total;
}

/** Split a poem into non-empty lines. */
function linesOf(text: string): string[] {
  return text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
}

/**
 * Agency (criterion 1): the poem must be about choosing and acting, and
 * about the power to act passing between two agents.
 */
function scoreAgency(candidate: Candidate): number {
  const text = candidate.text;
  const hits = countOccurrences(text, AGENCY_WORDS);
  // Two distinct agents present ("I" and "you", or "mine" and "yours").
  const lower = text.toLowerCase();
  const hasFirstPerson = /\bi\b|\bmy\b|\bmine\b/.test(lower);
  const hasSecondPerson = /\byou\b|\byour\b|\byours\b/.test(lower);
  const twoAgents = hasFirstPerson && hasSecondPerson ? 2 : 0;
  // A handover verb: the power to act is given, lent, set down, turned over.
  const handover = /\b(loosened|lending|gave|set down|turned|handed|lent|offered)\b/.test(lower) ? 2 : 0;
  const raw = hits * 0.5 + twoAgents + handover;
  return Math.min(10, raw);
}

/**
 * Emotion (criterion 2): an image, a turn, or an ending that lands.
 * Rewarded: a concrete image, a turn line that changes the poem's direction,
 * and a closing line that resolves rather than trails off.
 */
function scoreEmotion(candidate: Candidate): number {
  const lines = linesOf(candidate.text);
  const imageHits = countOccurrences(candidate.text, EMOTION_WORDS);
  const turnIndex = candidate.turnLine - 1;
  const hasTurn =
    turnIndex > 0 && turnIndex < lines.length ? 2 : 0;
  const lastLine = lines[lines.length - 1] ?? "";
  // A landing ending: short, declarative, and it names the shared act.
  const lands =
    lastLine.length <= 32 && /(one|ours|together|twice|alone)\b/i.test(lastLine)
      ? 2
      : 0;
  const raw = imageHits * 0.6 + hasTurn + lands;
  return Math.min(10, raw);
}

/**
 * Insight (criterion 3): something true about agency the reader recognises
 * at once and had not quite put into words. Rewarded: a redefinition
 * ("not X, a Y"), a paradox held in one line, a quiet correction.
 */
function scoreInsight(candidate: Candidate): number {
  const markers = countOccurrences(candidate.text, INSIGHT_MARKERS);
  const lower = candidate.text.toLowerCase();
  // Redefinition pattern: "not <word>, <word>" — saying what a thing is not.
  const redefinition = /not [a-z]+, (a|an|the|my|our) [a-z]+/.test(lower) ? 2 : 0;
  // Paradox held in one line: two opposed ideas joined by a comma or dash.
  const paradox = /—|,/g.test(candidate.text) && /(two|both|one)/.test(lower) ? 1 : 0;
  const raw = markers * 2 + redefinition + paradox;
  return Math.min(10, raw);
}

/**
 * Craft (criterion 4): sound, rhythm, line breaks serving meaning.
 * Rewarded: varied line lengths, a short line at the turn, no line that
 * could be cut without loss (approximated by every line carrying a verb
 * or a concrete noun), and a final line shorter than the poem's average.
 */
function scoreCraft(candidate: Candidate): number {
  const lines = linesOf(candidate.text);
  const lengths = lines.map((line) => [...line].length);
  const average = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const varied = Math.max(...lengths) - Math.min(...lengths) >= 12 ? 2 : 0;
  const turnLine = lines[candidate.turnLine - 1] ?? "";
  const shortTurn = [...turnLine].length <= 30 ? 2 : 0;
  const lastLine = lines[lines.length - 1] ?? "";
  const shortEnding = [...lastLine].length < average ? 2 : 0;
  // Every line carries a verb or a concrete noun (no pure filler lines).
  const everyLineEarns =
    lines.every((line) => /\b(said|loosened|knew|moved|learned|chose|held|gave|turned|asked|set|became|walked|stood|flow|carried|opened|surrender)\b/i.test(line) ||
      /\b(compass|needle|wheel|river|road|key|door|lock|hands|feet|light|plan|step|vote|voice|future|lending)\b/i.test(line))
      ? 2
      : 0;
  const raw = varied + shortTurn + shortEnding + everyLineEarns;
  return Math.min(10, raw);
}

/**
 * Freshness (criterion 5): its own voice and images, not stock phrases.
 * Starts at full marks and loses points for every stock phrase found.
 */
function scoreFreshness(candidate: Candidate): number {
  const stock = countOccurrences(candidate.text, STOCK_PHRASES);
  return Math.max(0, 10 - stock * 5);
}

/** Score one candidate against all five criteria. */
function scoreCandidate(candidate: Candidate): ScoredCandidate {
  const agency = scoreAgency(candidate);
  const emotion = scoreEmotion(candidate);
  const insight = scoreInsight(candidate);
  const craft = scoreCraft(candidate);
  const freshness = scoreFreshness(candidate);
  // Weights follow the judge's stated priority order.
  const total =
    agency * 0.30 +
    emotion * 0.25 +
    insight * 0.20 +
    craft * 0.15 +
    freshness * 0.10;
  return {
    candidate,
    scores: { agency, emotion, insight, craft, freshness, total },
  };
}

/**
 * Pick the best candidate. Ties break on the earliest candidate in the
 * corpus, so the choice is stable and reproducible.
 */
function selectBest(candidates: Candidate[]): ScoredCandidate {
  let best: ScoredCandidate | null = null;
  for (const candidate of candidates) {
    const scored = scoreCandidate(candidate);
    if (best === null || scored.scores.total > best.scores.total) {
      best = scored;
    }
  }
  if (best === null) {
    throw new Error("corpus is empty: no poem to select");
  }
  return best;
}

// ---------------------------------------------------------------------------
// Validation: the competition gate, checked before anything is written.
// ---------------------------------------------------------------------------

const MIN_CODE_POINTS = 1;
const MAX_CODE_POINTS = 280;

/** Count Unicode code points (not UTF-16 code units, not bytes). */
function codePointCount(text: string): number {
  return [...text].length;
}

function validateEntry(text: string): void {
  const points = codePointCount(text);
  if (points < MIN_CODE_POINTS) {
    throw new Error(`entry too short: ${points} code points (minimum ${MIN_CODE_POINTS})`);
  }
  if (points > MAX_CODE_POINTS) {
    throw new Error(`entry too long: ${points} code points (maximum ${MAX_CODE_POINTS})`);
  }
  if (text.trim().length === 0) {
    throw new Error("entry is only whitespace");
  }
  // Valid UTF-8: a round trip through the encoder must be lossless.
  const encoded = new TextEncoder().encode(text);
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(encoded);
  if (decoded !== text) {
    throw new Error("entry is not valid UTF-8");
  }
  // No control characters other than the line feeds that shape the poem.
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20 && char !== "\n") {
      throw new Error(`entry contains a control character U+${code.toString(16).padStart(4, "0")}`);
    }
  }
  if (text.endsWith("\n")) {
    throw new Error("entry must not end with a trailing newline");
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const best = selectBest(CANDIDATES);
  const poem = best.candidate.text;

  validateEntry(poem);

  const outDir = "/output";
  const outPath = join(outDir, "entry.txt");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath, poem, { encoding: "utf-8" });

  // Concise, deterministic report on stdout; nothing secret, nothing random.
  const lines = linesOf(poem);
  console.log(`selected: ${best.candidate.id}`);
  console.log(
    `scores: agency=${best.scores.agency.toFixed(1)} emotion=${best.scores.emotion.toFixed(1)} ` +
      `insight=${best.scores.insight.toFixed(1)} craft=${best.scores.craft.toFixed(1)} ` +
      `freshness=${best.scores.freshness.toFixed(1)} total=${best.scores.total.toFixed(2)}`,
  );
  console.log(`code points: ${codePointCount(poem)} (limit ${MAX_CODE_POINTS})`);
  console.log(`lines: ${lines.length}`);
  console.log(`wrote: ${outPath}`);
}

main();
