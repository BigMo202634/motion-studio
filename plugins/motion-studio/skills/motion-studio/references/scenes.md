# Scene recipes

Each is a copy-able pattern. Times are relative to the scene start `s`. Working code: recipes 1–5 in `examples/sample-15s.html`; glitch title, phone + notifications (8), money counter + bar chart, countdown (6), before/after (7) and confetti in `examples/sample-20s-landscape-dark.html`.

## 1. Kinetic hook headline
Kicker fades up (s+.1). Ghost word scales 1.25→1 behind (`expoOut`, 1.2s). Headline words stagger up with blur (s+.25, each .1).
The highlighted word slams in last (scale 1.8→1, rotate −6→0, `backOut`), then a 3-step skew shake. Cues: `whoosh` s, `impact` on the slam.

## 2. Card stack (product UI)
Main card rises with scale .94→1 and blur (`expoOut`). Chart line reveals with `clip` 0→1 (`inOut`, 1.3s).
Two small stat cards stagger in (`backOut`). Their numbers `MS.count` up. Cues: `whoosh` at the cut, `pop` per small card, and `MS.countSound` for each counter (same at/dur/ease as `MS.count`).

## 3. Big stat
Kicker, then a giant number (scale .6→1 `backOut`) counting up, then a sub-line. A tiny pulse (scale 1.04→1) when the count lands.
Cues: `swoosh-down`, `riser` under the count, `MS.countSound` ticks, and `ding` or `counter/xp_gain` on landing.

## 4. Feature chips + typing prompt
3 pill chips slide in from the left, staggered .16s (`backOut`). An input card rises. `MS.type` writes the prompt with a caret.
Cues: `pop` per chip, a `type` cue every .115s while typing.

## 5. Logo / CTA end card
Logo scales .5→1 with blur (`backOut`). Tagline fades up. Button rises, then a press (scale .93 → 1). Hold at least 1.2s.
Cues: `whoosh` and `impact` on the logo, `click` and `ding` on the press.

## 6. Countdown / timeline strip
A row of 3–4 day/step boxes; the active one fills with the accent (`--accent` background via a second overlay `clip` 0→1).
Optional live timer uses `MS.hook(t => el.textContent = …)`. Cue: `tick` per step.

## 7. Before → after
Split card: "before" (jagged red line, ✕ badge pops in with `backOut`), then a wipe (`clip`) to "after" (smooth accent line, ✓).
Cues: `impact` on the ✕, `whoosh` on the wipe, `ding` on the ✓.

## 8. Phone / app mock
Rounded rect 420×860, radius 60, dark bezel. Screens inside slide on `x` with `expoInOut` (0.7s). Taps: a 60px translucent circle scales 0→1.4 and fades out.
Cue: `click` per tap.

## 9. Numbered steps (1-2-3)
Giant accent numeral (280px) at the left, card at the right. Change the numeral with a vertical slide (old y→−80 and fade, new from 80).
Cue: `swoosh-down` per step.

## 10. Comment / social CTA
A fake comment input pill rises; text types in; a send button pulses. Use it only for the user's own account and call to action.

## Captions
One pill per scene with a highlighted word. In: `{opacity 0, y 30, scale .92}` → shown (`backOut`, .35s). Out: fade up, .25s, ending at the cut.

## 11. Glitch title
Stack two copies of the word (red `#FF2E63` and cyan `#00E5FF`, `mix-blend-mode: screen`) over the real one. For ~0.3s, `MS.set` them to opposite x/y offsets every 0.06s and skew the word, then snap back to 0. Cues: `glitch/glitch_fx_9` + `impact/bass_drop` on the first frame.

## 12. Bar chart grow
Bars with `transform-origin: bottom`, `MS.stagger(bars, {scaleY: 0}, {scaleY: 1}, at, .6, .12, 'backOut')`. Highlight the last bar in the second accent and pulse it. Cue a quiet `pop/pop_3` per bar, rising in gain.

## 13. Confetti burst
Make 60–80 small rounded rects in JS with a **seeded** random (never `Math.random`, or renders differ). Each one bursts out (`expoOut`, .9s) to a random angle, then falls and spins (`in`, 2s) while fading. Cues: `crowd/confetti_gift`, `crowd/party_horn`, a quiet `crowd/applause_cheer`.
