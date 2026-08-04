#!/usr/bin/env bash
set -euo pipefail

echo "== heartbeat drum: locating OracleResponse.tsx =="
ORACLE_FILE=$(find . -type f -name "OracleResponse.tsx" -not -path "*/node_modules/*" | head -n 1)
if [ -z "$ORACLE_FILE" ]; then
  echo "ERROR: could not find OracleResponse.tsx under $(pwd)" >&2
  exit 1
fi
echo "Found: $ORACLE_FILE"

ORACLE_DIR=$(dirname "$ORACLE_FILE")
LIB_DIR=$(cd "$ORACLE_DIR/../../lib" && pwd)
echo "Resolved lib dir: $LIB_DIR"

if [ -f "$LIB_DIR/heartbeatDrum.ts" ]; then
  echo "ERROR: $LIB_DIR/heartbeatDrum.ts already exists — aborting so nothing is silently overwritten." >&2
  exit 1
fi

echo "== writing lib/heartbeatDrum.ts =="
cat > "$LIB_DIR/heartbeatDrum.ts" <<'HEARTBEAT_EOF'
/**
 * heartbeatDrum.ts
 *
 * Subtle rhythmic "lub-dub" pulse layered under active reading delivery in
 * OracleResponse only — starts when the word-by-word reveal begins, stops
 * the instant the reveal completes (before the glyph / ceremonial closing /
 * ThresholdLetter). Ref-counted start/stop, own short-lived AudioContext,
 * lookahead scheduling so tempo doesn't drift over a long reading.
 */

const BPM = 92; // slightly faster than resting heart rate (~60-80bpm)
const BEAT_INTERVAL_SEC = 60 / BPM;
const LUB_DUB_GAP_SEC = 0.14; // gap between "lub" and "dub" within one beat
const SCHEDULE_AHEAD_SEC = 0.15; // how far ahead we schedule audio events
const SCHEDULER_TICK_MS = 50; // how often the scheduler loop wakes up

const LUB_FREQ = 55; // low sine, "lub" (primary)
const DUB_FREQ = 45; // low sine, "dub" (softer secondary)
const LUB_GAIN = 0.045; // kept well below ambient tone / narration
const DUB_GAIN = 0.03;
const PULSE_ATTACK_SEC = 0.01;
const PULSE_DECAY_SEC = 0.18;

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let refCount = 0;
let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let nextBeatTime = 0;
let stopped = true;

function ensureContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(audioCtx.destination);
  }
  return audioCtx;
}

function schedulePulse(ctx: AudioContext, time: number, freq: number, gain: number) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, time);

  env.gain.setValueAtTime(0, time);
  env.gain.linearRampToValueAtTime(gain, time + PULSE_ATTACK_SEC);
  env.gain.exponentialRampToValueAtTime(0.0001, time + PULSE_ATTACK_SEC + PULSE_DECAY_SEC);

  osc.connect(env);
  env.connect(masterGain!);

  osc.start(time);
  osc.stop(time + PULSE_ATTACK_SEC + PULSE_DECAY_SEC + 0.02);
}

function scheduleBeat(ctx: AudioContext, beatTime: number) {
  schedulePulse(ctx, beatTime, LUB_FREQ, LUB_GAIN);
  schedulePulse(ctx, beatTime + LUB_DUB_GAP_SEC, DUB_FREQ, DUB_GAIN);
}

function schedulerLoop() {
  if (!audioCtx || stopped) return;

  while (nextBeatTime < audioCtx.currentTime + SCHEDULE_AHEAD_SEC) {
    scheduleBeat(audioCtx, nextBeatTime);
    nextBeatTime += BEAT_INTERVAL_SEC;
  }
}

/**
 * Start the heartbeat drum. Ref-counted so overlapping callers (e.g. a
 * reveal that gets retriggered before cleanup runs) can't stop each other's
 * instance early — only the first caller actually starts the scheduler.
 */
export function startHeartbeatDrum() {
  refCount += 1;
  if (refCount > 1) return;

  const ctx = ensureContext();
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {
      /* best-effort; ceremony should never hard-fail on audio */
    });
  }

  stopped = false;
  nextBeatTime = ctx.currentTime + 0.1;
  schedulerLoop();
  schedulerTimer = setInterval(schedulerLoop, SCHEDULER_TICK_MS);
}

/**
 * Stop the heartbeat drum. Only tears down once every start() has a
 * matching stop() (ref count reaches 0). Safe to call more than once —
 * guarded against going below zero.
 */
export function stopHeartbeatDrum() {
  if (refCount === 0) return;
  refCount -= 1;
  if (refCount > 0) return;

  stopped = true;
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}
HEARTBEAT_EOF
echo "Wrote $LIB_DIR/heartbeatDrum.ts"

echo "== patching $ORACLE_FILE =="
python3 - "$ORACLE_FILE" <<'PYEOF'
import sys

path = sys.argv[1]
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

replacements = [
    (
        "import ThresholdLetter from './ThresholdLetter';",
        "import ThresholdLetter from './ThresholdLetter';\n"
        "import { startHeartbeatDrum, stopHeartbeatDrum } from '../../lib/heartbeatDrum';",
    ),
    (
        "    setCompletedLines([]);\n"
        "    setPartialLine([]);\n"
        "    setShowGlyph(false);\n"
        "    setShowClosing(false);\n"
        "    setShowAskAgain(false);\n"
        "    clearTimers();\n"
        "\n"
        "    let li = 0;",
        "    setCompletedLines([]);\n"
        "    setPartialLine([]);\n"
        "    setShowGlyph(false);\n"
        "    setShowClosing(false);\n"
        "    setShowAskAgain(false);\n"
        "    clearTimers();\n"
        "\n"
        "    if (soundEnabled) {\n"
        "      startHeartbeatDrum();\n"
        "    }\n"
        "\n"
        "    let li = 0;",
    ),
    (
        "      if (li >= linesOfWords.length) {\n"
        "        addTimer(() => setShowGlyph(true), 600);\n"
        "        addTimer(() => setShowClosing(true), 8600);\n"
        "        addTimer(() => setShowAskAgain(true), 11200);\n"
        "        return;\n"
        "      }",
        "      if (li >= linesOfWords.length) {\n"
        "        if (soundEnabled) {\n"
        "          stopHeartbeatDrum();\n"
        "        }\n"
        "        addTimer(() => setShowGlyph(true), 600);\n"
        "        addTimer(() => setShowClosing(true), 8600);\n"
        "        addTimer(() => setShowAskAgain(true), 11200);\n"
        "        return;\n"
        "      }",
    ),
    (
        "    addTimer(revealNextWord, 400);\n"
        "    return clearTimers;\n"
        "  }, [text]);",
        "    addTimer(revealNextWord, 400);\n"
        "    return () => {\n"
        "      clearTimers();\n"
        "      if (soundEnabled) {\n"
        "        stopHeartbeatDrum();\n"
        "      }\n"
        "    };\n"
        "  }, [text]);",
    ),
]

for old, new in replacements:
    count = content.count(old)
    if count != 1:
        sys.stderr.write(
            f"ERROR: expected exactly 1 match, found {count}, for anchor starting:\n{old[:70]!r}\n"
        )
        sys.exit(1)
    content = content.replace(old, new)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Patched OracleResponse.tsx (4/4 anchors matched).")
PYEOF

echo "== typecheck =="
if command -v npx >/dev/null 2>&1; then
  npx tsc --noEmit
else
  echo "npx not found, skipping tsc" >&2
fi

echo "== build =="
npm run build

echo "== committing =="
git add "$LIB_DIR/heartbeatDrum.ts" "$ORACLE_FILE"
git commit -m "feat: subtle heartbeat drum during reading delivery

Adds a low-gain lub-dub pulse (~92bpm) scoped to OracleResponse's
active word-by-word reveal only — starts when the reveal begins,
stops the instant it completes (before glyph/closing/ThresholdLetter).
Gated behind soundEnabled, ref-counted like the ambient tone."

echo "== pushing =="
git push origin HEAD

echo "Done: committed and pushed."