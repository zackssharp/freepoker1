import { createDeck, type Card } from "../lib/poker/cards";
import { evaluateHand, HAND_CATEGORIES } from "../lib/poker/evaluator";

let failures = 0;
const check = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) {
    failures++;
    console.log(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`);
  }
};
const cat = (cards: string) =>
  HAND_CATEGORIES[evaluateHand(cards.split(" ") as Card[]).category];
const label = (cards: string) => evaluateHand(cards.split(" ") as Card[]).label;
const score = (cards: string) => evaluateHand(cards.split(" ") as Card[]).score;

check("royal flush", label("As Ks Qs Js Ts 2c 3d"), "Royal Flush");
check("straight flush", label("9h 8h 7h 6h 5h Ac Kd"), "Straight Flush, Nine high");
check("steel wheel", label("Ah 2h 3h 4h 5h Kc Qd"), "Straight Flush, Five high");
check("quads", label("7c 7d 7h 7s Kc 2d 3h"), "Four of a Kind, Sevens");
check("boat", label("Kc Kd Kh 3s 3c 2d 7h"), "Full House, Kings full of Threes");
check("two trips -> boat", label("Kc Kd Kh 3s 3c 3d 7h"), "Full House, Kings full of Threes");
check("flush", label("Ac 9c 7c 5c 3c Kd Qh"), "Flush, Ace high");
check("straight", label("9c 8d 7h 6s 5c Ad Kh"), "Straight, Nine high");
check("wheel", label("Ac 2d 3h 4s 5c Kd Qh"), "Straight, Five high");
check("trips", label("Qc Qd Qh 9s 5c 2d 3h"), "Three of a Kind, Queens");
check("two pair", label("Ac Ad 9h 9s 5c 2d 3h"), "Two Pair, Aces and Nines");
check("three pair uses top two", label("Ac Ad 9h 9s 5c 5d 3h"), "Two Pair, Aces and Nines");
check("pair", label("Ac Ad 9h 8s 5c 2d 3h"), "Pair of Aces");
check("high card", label("Ac Kd 9h 8s 5c 2d 3h"), "High Card, Ace");
check("no straight across gap", cat("Ac Kd Qh Js 9c 2d 3h"), "High Card");

// Kickers must decide otherwise-identical hands.
const betterKicker = score("Ac Ad Kh 8s 5c") > score("Ac Ad Qh 8s 5c");
check("pair kicker", betterKicker, true);
check("two pair kicker", score("Ac Ad 9h 9s Kc") > score("Ac Ad 9h 9s Qc"), true);
check("flush kicker", score("Ac 9c 7c 5c 3c") > score("Kc 9c 7c 5c 3c"), true);

// Category ordering must be strict across the whole ladder.
const ladder = [
  "Ac Kd 9h 8s 5c",
  "2c 2d 9h 8s 5c",
  "2c 2d 9h 9s 5c",
  "2c 2d 2h 9s 5c",
  "9c 8d 7h 6s 5c",
  "Ac 9c 7c 5c 3c",
  "2c 2d 2h 9s 9c",
  "2c 2d 2h 2s 9c",
  "9h 8h 7h 6h 5h",
];
for (let i = 1; i < ladder.length; i++) {
  check(`ladder ${i}`, score(ladder[i]!) > score(ladder[i - 1]!), true);
}

// Every 7-card hand drawn from a real deck must evaluate without throwing,
// and must never beat the best possible hand.
const deck = createDeck();
check("deck size", deck.length, 52);
const royal = score("As Ks Qs Js Ts");
let sampled = 0;
for (let trial = 0; trial < 20000; trial++) {
  const shuffled = deck.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  const rank = evaluateHand(shuffled.slice(0, 7));
  sampled++;
  if (rank.score > royal) {
    failures++;
    console.log(`FAIL beat royal: ${shuffled.slice(0, 7).join(" ")} -> ${rank.label}`);
    break;
  }
}
check("fuzz ran", sampled, 20000);

console.log(failures === 0 ? "evaluator: all checks passed" : `evaluator: ${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
