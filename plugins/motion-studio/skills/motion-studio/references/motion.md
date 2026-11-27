# Motion

Smooth means: eased, layered, and continuous. Most "ugly AI animation" comes from linear moves,
everything starting at once, and hard cuts.

## Easing (names in `MS.ease`)

| Use | Ease | Duration |
|---|---|---|
| Things arriving (text, cards) | `expoOut` or `out` | 0.5–0.8s |
| Playful arrivals (chips, buttons, emphasized word, logo) | `backOut` | 0.4–0.7s |
| Things leaving | `in` | 0.25–0.4s (exits are faster than entrances) |
| Moving across the screen or morphing | `inOut` / `expoInOut` | 0.6–1.2s |
| Line/progress reveals (`clip`) | `inOut` | 1.0–1.5s |
| Counters | `expoOut` | 1.2–1.8s |
| Idle float | `MS.float(sel, 12–18px, 3–4s)` | the whole video |

`linear` only for shakes, clicks, and `set`.

## Entrance recipe

Combine 2–3 channels, never only opacity:
`{ opacity: 0, y: 60–140, blur: 10–14 } → { opacity: 1, y: 0, blur: 0 }` (`expoOut`)
or `{ opacity: 0, scale: .6–.9 } → { opacity: 1, scale: 1 }` (`backOut`).
Words in a headline: stagger 0.08–0.12s. Cards: 0.12–0.16s. Chips/list rows: 0.14–0.18s.

## Scene transitions

- Outgoing scene: `MS.to('#sN', { opacity: 0, y: -50, blur: 10 }, end - .3, .35, 'in')`, or scale to .94 with blur.
- Incoming scene starts its first entrance at exactly the cut and overlaps the exit by about 0.1–0.2s.
- Background objects shift a little at each cut (`x ±24, rotate ±8`, `inOut`, 0.9s) so the world is continuous.
- Put a `whoosh` (or `swoosh-down`) on every cut.

## Rhythm

- Hook: something moves at t = 0.05s. The first headline is readable by 1.0s.
- Give each scene one **accent beat**, such as a word that slams in (scale 1.8→1 `backOut` plus a small skew shake), a number that lands, or a button press (scale .93 → 1 `backOut`). Put `impact`, `ding` or `click` on it.
- Hold: after the last element lands, keep the scene still (only the float) for at least 0.8s so it can be read.
- The final CTA holds for at least 1.2s.

## Rules

- Never more than 3 elements arriving in the same 0.3s window.
- Never animate `width/height/top/left` for movement; use `x/y/scale`.
- Reading time: on-screen at least 0.3s per word + 0.5s.
- Captions enter just after the visual they describe (+0.2–0.4s), not before.
- Counters and typing always have sound: `MS.countSound(at, dur, ease)` for every `MS.count`, and a `type` cue every 0.1–0.12s while typing.
