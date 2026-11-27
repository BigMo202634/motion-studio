---
name: motion-studio
description: Make polished short motion-graphics videos (promos, product teasers, explainers, social reels, UI animations) as HTML scenes rendered to MP4 with synced sound effects. Use when the user asks for an animation, animated video, reel, promo, motion graphic, or "make me an N-second video".
---

# Motion Studio

Version 1.0.0 · What changed: `CHANGELOG.md` · Latest: https://github.com/BigMo202634/motion-studio/releases

Turns a one-line request ("make me a 15-second promo for my app") into a smooth, designed MP4.
Claude on its own tends to make stiff, jittery, cluttered animations. This skill fixes that with
three things: a **seekable timeline runtime** (`assets/motion.js`), **written-down taste**
(style, motion and scene rules in `references/`), and a **frame-exact renderer with sound**
(`scripts/render.mjs` + `scripts/sfx.py`).

## Files

| Path | What it is |
|---|---|
| `assets/motion.js` | Tiny dependency-free timeline: `MS.fromTo / to / stagger / count / countSound / type / float / captions / keywords / cutout / cue / seek`. |
| `examples/sample-15s.html` | 15s vertical (1080×1920) light promo: kinetic hook, card stack, big stat, chips + typing, CTA. **Default starting template.** |
| `examples/sample-20s-landscape-dark.html` | 20s widescreen (1920×1080) dark launch film: glitch title, phone + notifications, money counter + bar chart, 3-2-1 countdown, before/after, logo + confetti. Start here for landscape, dark, fintech/tech or launch videos. |
| `references/style.md` | Look: palettes (3 presets), type scale, layout grid, depth and shadow rules. |
| `references/motion.md` | Feel: easing, durations, stagger, transitions, and the rules that make motion smooth. |
| `references/scenes.md` | Scene recipes: hook, card stack, big stat, feature chips, typing prompt, CTA, and more. |
| `references/sound.md` | Sound: which effect goes on which kind of moment, and how loud. |
| `scripts/render.mjs` | Renders the HTML frame-by-frame to MP4, mixes in sound. `--stills` for quick check frames. |
| `assets/fonts/` | 40 trending font families (Geist, Inter, Bricolage Grotesque, Instrument Serif, Anton, Unbounded...) + `fonts.css`. |
| `assets/sfx/` | `catalog.md` + `sounds.json`: the 176 real recorded sound effects (Mixkit + Pixabay) in 18 categories. The files themselves are downloaded once by `scripts/get_sounds.py` (licence: no redistribution). |
| `scripts/get_sounds.py` | One-time download of the sound effects into `~/.motion-studio/sfx` (kept across updates). |
| `scripts/sfx.py` | Mixes the recorded effects at the cue times (with aliases like `whoosh`, `pop`). |
| `scripts/matte.py` | Cuts the person out of every footage frame (mediapipe) so big captions can sit **behind** them; writes `cutout/` + `cover.js`. |
| `assets/models/` | Person-segmentation models for `matte.py` (selfie + multiclass). |
| `scripts/transcribe.py` | Word-level timings from the user's footage (faster-whisper) for `MS.captions`; `--script` fallback. |
| `examples/realestate-talking-head.html` | **Default real estate template (overlay on real footage)**: big lime keyword captions behind the agent, small white words, framed agent portrait, price counter, spec chips, photo cards, map pin, "calling," phone-pill CTA. |
| `examples/realestate-bold-captions.html` | Alternative real estate look: bold uppercase stroked captions under the chin, gold on dark. Only when asked. |
| `references/talking-head.md` | How to work with the user's own talking-head / property footage (real estate playbook). |

## Workflow

**If the user gives you a video of a person talking (talking head, realtor, coach, founder), read `references/talking-head.md` first: that is an overlay job, not a from-scratch animation.**

1. **Brief (do not over-ask).** Pull from the request: subject, length (default 15s), format
   (default vertical 1080×1920; 1920×1080 for "YouTube/landscape"; 1080×1080 for "square"),
   style preset (default *Minimal Light*), and the one message the viewer should remember.
   Ask at most one question, only if the subject itself is unknown. Otherwise choose and state your choices.
2. **Storyboard first.** Write a short scene table before any code: for each scene give time range,
   on-screen text (≤ 6 words per headline), caption, the motion recipe from `references/scenes.md`,
   and sound cues. Rule of thumb: 2.5–3.5s per scene, so 4–5 scenes for 15s. Scene 1 must hook within 1 second;
   the last scene is a CTA or logo that holds still for at least 1.2s.
3. **Build.** In the user's project (or a new folder) copy `assets/motion.js` and the closest example (vertical/light → `sample-15s.html`, landscape/dark → `sample-20s-landscape-dark.html`)
   plus the `assets/fonts` folder (fix the `<script src>` and font `<link>` paths). Replace the scenes, keep the structure: persistent background objects,
   one `.scene` div per scene, one caption per scene, the timeline at the bottom grouped by scene,
   each group ending with its `MS.cue(...)` calls. Read `references/style.md` (pick a font pairing there) and `references/motion.md` before writing CSS or tweens, and `references/sound.md` before writing cues.
4. **Check stills.** `node scripts/render.mjs scene.html --stills 1,4,7.5,10.5,14` and **look at the PNGs**.
   Fix overflow, overlaps, text over 90% of the width, empty bottom halves, and low contrast. Repeat until clean.
5. **Render.** `node scripts/render.mjs scene.html --out video.mp4`
   Over the user's footage: add `--background their-video.mp4` (their voice is kept, effects sit under it).
   For real estate, run `scripts/matte.py` first so the keywords go behind the agent.
   Music only if the user supplies a track: `--music track.mp3` (ducked under the voice automatically).
   Never invent background music. `--no-audio` for silent.
   About 25s for a 15s video at 30fps.
6. **Verify and deliver.** Pull 4–6 frames from the MP4 (`ffmpeg -i video.mp4 -vf "select='eq(n,30)+eq(n,150)+…',tile=5x1" -frames:v 1 sheet.png`)
   and look at them. Confirm duration and the audio stream with `ffprobe`. Deliver the MP4 and the HTML source,
   and say the 1-line edit for the most likely tweak (text, color, or timing).

## Setup (first run on a machine)

- Node 18+, `npm i -D playwright && npx playwright install chromium` (or set `CHROMIUM_PATH` to an existing Chrome).
- `ffmpeg` on PATH. `python3` with `numpy` for sound.
- **Sounds (once per computer):** `python3 scripts/get_sounds.py`. If `~/.motion-studio/sfx` is missing or empty, run it before the first render and tell the user it is a one-time download (about 2 minutes).
- Talking-head jobs: `pip install faster-whisper mediapipe opencv-python-headless pillow` (captions + person cut-out).
- If a dependency is missing, tell the user the one install command. Do not silently fall back to a GIF or CSS-only demo.

## Updates

If the user asks whether there is a newer version, compare the version at the top of this file with
https://github.com/BigMo202634/motion-studio/releases and summarise `CHANGELOG.md`. After an update, re-run
`scripts/get_sounds.py` (it only fetches sounds that are new).

## Non-negotiables

- Never put a CSS `transform` on an element that `MS` animates; MS owns `transform`, `opacity`, `filter`, `clip-path`.
  Position with `left/top` or wrap the element. (`MS.float` uses the separate `translate` property, so it stacks safely.)
- Every element enters with motion **and** leaves before its scene ends. Nothing just pops on or vanishes.
- One accent color, one highlighted word per headline and caption.
- No linear easing on movement. No tween under 0.2s except shakes and clicks. No more than 3 things moving into place at once.
- Use only fonts installed or embedded; check stills for fallback fonts.
- Content must be original: don't recreate a specific brand's ad, logo, or characters unless the user owns them.
