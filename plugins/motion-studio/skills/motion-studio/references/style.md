# Style

The look that reads as "premium SaaS / Apple-like": lots of air, one accent, soft depth, huge confident type.

## Palettes (CSS tokens, put on `:root`)

**Minimal Light (default)**
`--bg #F3F1EC · --ink #121212 · --muted #6B6862 · --accent #FF5A1F · --accent-soft #FFE3D6 · --card #FFFFFF · --blue #2F5BFF · --lime #C8F04A`
Background: radial gradient, white in the upper-middle fading to `#E9E5DD` at the corners.

**Bold SaaS**
`--bg #0F1115 · --ink #F5F5F2 · --muted #9AA0AA · --accent #7C5CFF · --accent-soft #2A2350 · --card #191C22 · --blue #3DD6FF · --lime #B6FF4A`
Cards get a 1px `rgba(255,255,255,.06)` border instead of heavy shadows. Glow the accent: `box-shadow: 0 0 60px -10px var(--accent)`.

**Glass**
Light preset plus frosted cards: `background: rgba(255,255,255,.55); backdrop-filter: blur(24px) saturate(1.4); border: 1px solid rgba(255,255,255,.7)`.
Put colorful blurred blobs (`filter: blur(80px)`) behind so the glass has something to frost.

If the user has a brand, swap `--accent` (and fonts) only. Keep everything else.

## Fonts (bundled, all free: SIL OFL / Apache)

Link `assets/fonts/fonts.css` in every scene (`<link rel="stylesheet" href="fonts/fonts.css">` after copying the folder)
and the renderer waits for them. Never rely on system fonts. `assets/fonts/catalog.json` lists all 40 families.

| Vibe | Display (headlines) | Text (UI, captions) |
|---|---|---|
| Clean SaaS / Apple-like (default) | Bricolage Grotesque 800, Inter Tight 800 | Geist, Inter |
| Tech / dev tool | Geist 800, Space Grotesk 700 | Geist Mono, JetBrains Mono |
| Friendly startup | Plus Jakarta Sans 800, Manrope 800, Outfit 800 | DM Sans, Figtree |
| Bold editorial | Instrument Serif (italic for one word), Fraunces 700, Playfair Display | Instrument Sans, Inter |
| Loud social / hype | Anton, Bebas Neue, Archivo Black, Dela Gothic One, Big Shoulders Display 900 | Inter 700 |
| Futuristic / wide | Unbounded 800, Syne 800, Krona One, Sora 700 | Sora, Onest |
| Handwritten accent (one word only) | Caveat 700, Permanent Marker | |
| Classic viral captions | Montserrat 900, Poppins 800 | Poppins 600 |

Pair one display face with one text face. Use at most 2 families per video (3 only with a handwritten accent).
A strong trend: sans headline with **one word in Instrument Serif italic** in the accent color.

## Type

- Display: weight 800–900, letter-spacing −0.04em, line-height 0.95.
- Sizes at 1080 wide: hero headline 120–150px (max 2 lines, ≤ 14 characters per line), big stat 260–320px, card title 34px, body 26px, kicker 34px muted.
- Captions: 44–48px bold white on an 88% black pill, radius 22px, bottom-centered about 330px above the bottom edge (clear of app UI on Reels/TikTok).
- Highlight exactly one word with `--accent`.
- A **ghost word** behind a scene (300px, 5% ink) adds depth cheaply.

## Layout

- Safe area for vertical: 110px side margins, keep key content between y=380 and y=1500.
- Center the main element on the vertical third line or a little above center, never at the top edge.
- Cards: radius 32–40px, padding 44–48px, max 2 columns, 40px gaps.
- Check that the bottom half isn't empty. If it is, move the scene group down (`.scene { inset: 130px 0 -130px 0 }`).

## Depth: floating primitives

Persistent, small 3D-looking objects scattered at the edges make the world feel alive between scenes:
spheres (radial gradient with a highlight at 32% 30%), a rounded cube, a thin ring (`border: 14px solid accent`, squashed to an ellipse).
5–7 of them, sizes 50–150px, mostly near edges, never behind text. Use accent, blue, white, black and lime spheres.
They `MS.float` gently all the time and shift a little on each scene change (parallax).

## Shadow

`0 30px 60px -20px rgba(30,20,10,.18), 0 8px 18px -8px rgba(30,20,10,.12)`. Warm, soft and low. Never pure black or hard.
