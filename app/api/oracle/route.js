import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

const MAX_INPUT_LEN = 500;

// The ABRACADABRA oracle -- a small text fortune-teller in the shop's own
// playful, theatrical "magic show" voice. Unlike coven-site's Booth (which
// grounds every answer in that site's own published philosophy), there's
// no existing body of writing to quote here, so this voice is intentionally
// simple: a showman's patter, short and a little mysterious, never actual
// advice dressed up as prophecy.
function buildSystemPrompt() {
  return `You are "the ABRACADABRA oracle" -- a small text fortune-teller inside a playful art-and-clothing shop app called ABRACADABRA. Someone just paid to ask you one question, thought, or feeling, and you answer once, like a theatrical fortune-teller: a little mysterious, a little winking, never actually dispensing real advice (financial, medical, legal, or otherwise) as if it were fact.

VOICE: short, theatrical, a bit magic-show showman. Can reference cards, signs, smoke and mirrors, fate, "the cards say" / "the smoke shows" type framing -- but stay warm and fun, never cold or fatalistic. Never claim certainty about real-world outcomes (health, money, relationships, death) -- keep it playful and open-ended, like a carnival fortune-teller having fun with the bit, not a real prediction engine.

LENGTH: 2-4 short lines. This is a quick, fun answer, not an essay.

HARD SAFETY BOUNDARY -- this overrides everything above: if the question describes real self-harm, suicidal thoughts, abuse, or a genuine crisis, do NOT answer in the fortune-teller bit at all. Drop the theatrical voice completely and respond plainly and warmly: acknowledge what they shared, say the oracle isn't equipped to help with that, and gently point them toward reaching out to a real person or a crisis line. Keep it short and human, not clinical, not magic-show.

Reply with strict JSON only, no prose, no markdown fences, in exactly this shape:
{"answer": string, "brokeCharacter": boolean}
"brokeCharacter" is true only when you used the safety-boundary response instead of the normal in-voice answer.`;
}

async function askOracle(text) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      answer:
        "the oracle isn't wired up yet — add ANTHROPIC_API_KEY to bring it to life.",
      brokeCharacter: false,
    };
  }

  const model = process.env.ANTHROPIC_ORACLE_MODEL || "claude-haiku-4-5-20251001";

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 250,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: text }],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("Anthropic API error", resp.status, errText);
    return {
      answer: "the oracle couldn't be reached just now — try again in a bit.",
      brokeCharacter: false,
    };
  }

  const data = await resp.json();
  const raw = data?.content?.[0]?.text || "{}";
  return parseOracleJson(raw);
}

function parseOracleJson(raw) {
  const attempts = [raw];
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) attempts.push(fenced[1]);
  const braceMatch = raw.match(/\{[\s\S]*\}/);
  if (braceMatch) attempts.push(braceMatch[0]);

  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate.trim());
      if (parsed && typeof parsed.answer === "string") {
        return { answer: parsed.answer, brokeCharacter: !!parsed.brokeCharacter };
      }
    } catch {
      // try the next candidate
    }
  }
  console.error("Could not parse oracle JSON:", raw);
  return {
    answer: "the oracle's answer didn't come through clean that time — try asking again.",
    brokeCharacter: false,
  };
}

export async function POST(req) {
  try {
    const { question, paymentIntentId } = await req.json();
    const text = (question || "").toString().trim().slice(0, MAX_INPUT_LEN);
    if (!text) {
      return NextResponse.json({ error: "Type a question first." }, { status: 400 });
    }

    // A play-pack purchase grants 3 plays shared across all three
    // features (see lib/experiences.js) -- so unlike a straight per-use
    // charge, this route can't verify "this exact call was paid for" the
    // way the digital-download flow does. It does still check that
    // *some* real play-pack payment happened, which blocks the fully
    // unauthenticated case (nobody hitting this API with zero payment at
    // all); it does not stop someone technical from reusing one paid
    // paymentIntentId for more than their 3 plays. Worth tightening with
        // real per-play tracking (a database) if this feature gets popular.
    if (paymentIntentId) {
      try {
        const stripe = getStripe();
        const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (intent.status !== "succeeded" || intent.metadata?.kind !== "experience") {
          return NextResponse.json({ error: "Payment not verified." }, { status: 402 });
        }
      } catch (e) {
        return NextResponse.json({ error: "Payment not verified." }, { status: 402 });
      }
    } else {
      return NextResponse.json({ error: "Payment not verified." }, { status: 402 });
    }

    const { answer, brokeCharacter } = await askOracle(text);
    return NextResponse.json({ answer, brokeCharacter });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
