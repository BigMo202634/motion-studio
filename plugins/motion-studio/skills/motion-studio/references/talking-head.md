# Talking-head & real estate videos (overlay mode)

Most real users bring **their own footage**: a realtor, coach or founder talking to the phone camera, often with
property clips. The job is to make that footage feel produced: captions, name tag, data cards, photos, sound.
The person stays the star; overlays support what they are saying, at the moment they say it.

## Pipeline
1. Get the footage (vertical 1080×1920 is normal) and the facts: agent name, brokerage, price, beds/baths/size,
   address or area, 3–6 listing photos, call to action (comment keyword, phone, link).
2. Captions: `python3 scripts/transcribe.py talking.mp4 words.js` (faster-whisper, word timings).
   Open `words.json` and fix names, street names and numbers. If no model can be installed, use
   `--script "exact words"`, which spreads the script over the detected speech.
3. Cut the agent out of the footage: `python3 scripts/matte.py talking.mp4 cutout` (mediapipe; about 15s of work
   per 1s of 1080p footage on a laptop CPU). This lets the big keywords sit **behind** the agent.
   Skip it and the template still works, with the keywords in front.
4. Copy `examples/realestate-talking-head.html` (the default look) next to the footage, photos, `words.js` and `cutout/`, plus `assets/motion.js` and `assets/fonts`.
   Old bold-caption look (big uppercase words with a stroke under the chin): `examples/realestate-bold-captions.html`, only if the user asks for it.
   Edit only the `AGENT / LISTING / MOMENTS` block. Set each MOMENT to the second where the agent **says** it
   (price card when they say the price, map when they mention the area). Read the timings from `words.json`.
5. Check stills over the real frames: `node scripts/render.mjs scene.html --background talking.mp4 --stills 1,4,8,12`.
   Look for overlays covering the face. Move cards to the free area (usually top 250–850px when the face is lower, or below 1450px).
6. Render: `node scripts/render.mjs scene.html --background talking.mp4 --out final.mp4 [--music their-track.mp3]`.
   Length follows the footage (`MS.duration('auto')`). Voice is kept, effects go under it, music ducks.

## Real estate overlay kit (in the template)
| Overlay | When | Sound |
|---|---|---|
| Big lime keyword behind the agent | each selling word, when it is said | very soft `whoosh/sweep_short` / `swoosh_quick_accent` at .3 |
| Framed agent portrait with JUST LISTED tag | 0.5–4s, once | `pop/pop_dry` |
| Price counter | when they say the price | `MS.countSound` → `money/cash_register_kaching` |
| Beds / baths / size chips | right after the price | `pop/pop_message` per chip |
| Photo cards with slow zoom | while they describe rooms, 2s each | `whoosh/swipe_quick` + soft `camera/camera_shutter` |
| Map + pin drop + address | when they mention location | `whoosh/swoosh_air`, `pop/pop_hard_click` on the pin |
| "calling," + phone pill (agent photo, red/green buttons, green pulses) + comment tip | last 2–3s | `ui/phone_vibration` |

Other stamps to swap in: SOLD (red `#E2483D`), UNDER CONTRACT, PRICE DROP (with a strike-through old price),
OPEN HOUSE SAT 1–4PM. For market-update videos, replace the photo cards with stat cards (median price, days on market) using `MS.count` + `MS.countSound`.

## Caption rules: the luxe keyword look (default)
This is the style the user picked from a top-performing listing reel. Get these right and it looks the same:
- **One big word at a time**, not a running transcript. Pick 6–10 selling words from `words.json` (rooms, features,
  price word, area, CTA word) and list them in `KEYWORDS`. Each appears the moment it is spoken and holds ~1.7s.
- **Font and colour:** Nunito 900, rounded and heavy, title case, lime `#CDEB5E`, tight tracking (-0.035em), fit to 980px wide.
- **Behind the agent:** the word sits in the upper third and the agent's head passes in front of it (`MS.cutout` + the
  `.ms-behind` layer). `MS.keywords` reads `cutout/cover.js` and, word by word, picks the spot where the agent
  hides the least; if the head would hide more than 30% of it at any point, that word comes in front instead
  (common in close selfie shots; it stays readable). Wider shots where the agent stands lower get the full behind effect.
- **Motion:** fades up from soft and semi-transparent (blur 10 → 0, scale 1.06 → 1, 0.45s), blurs out before the next word. No pops, no bounce.
- **Small white words** at the top (y≈82, Nunito 800, 50px, soft shadow) show the phrase being said, 3 words at a time. Turn off with `SMALL_CAPTIONS = false`.
- Fix every name and number in `words.json` before rendering. Wrong prices destroy trust.
- Never put a keyword over the eyes or mouth when it is in front: keep `tops` in the forehead/hair band (150–300).

## Style for realtors
- Default (luxe keyword): lime `#CDEB5E` keywords, white cards, Nunito everywhere. Change `--accent` for a brand colour; keep it light and saturated so it reads on interiors.
- Luxury dark: gold `#E8C872` on near-black, Instrument Serif headlines (`realestate-bold-captions.html`).
- Modern/clean: white cards, black text, one brand accent from the brokerage.
- Keep the brokerage's colors and logo if the user gives them. Never invent a real brokerage's branding.
- Respect fair-housing language: describe the property, never who "should" live there.
