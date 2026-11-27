# Motion Studio

A Claude skill that turns one sentence into a polished, sound-designed video:
promos, product teasers, social reels, and **real estate talking-head reels** made from the agent's own footage.

- Smooth, frame-exact animation rendered to MP4
- 176 real sound effects (whooshes, pops, counter ticks, cash register, alerts...), synced to the motion
- 41 trending fonts
- Real estate look: one big keyword at a time sitting **behind** the agent, small captions, agent photo card,
  price counter, photo cards, map, "calling" phone CTA
- Captions from the agent's own speech, plus a person cut-out so the words can go behind them

Current version: see [CHANGELOG.md](CHANGELOG.md) and [Releases](https://github.com/BigMo202634/motion-studio/releases).

## Install

### Claude Code or the Claude desktop app (recommended: updates in one command)
```
/plugin marketplace add BigMo202634/motion-studio
/plugin install motion-studio@bigmo-skills
```

### claude.ai
1. Download `motion-studio.zip` from the latest [Release](https://github.com/BigMo202634/motion-studio/releases/latest).
2. In Claude: **Customize → Skills → Add → Upload skill** and pick the zip.

## First run (once per computer)
The skill renders real video, so the computer needs **Node 18+**, **ffmpeg** and **Python 3**. Claude installs what
is missing the first time. It also downloads the sound effects once:
```
python3 scripts/get_sounds.py
```
The sounds come from Mixkit and Pixabay. They are free to use in your videos (commercial too, no credit needed),
but their licences don't allow sharing the files themselves, so each computer downloads them from the source.
They're saved in `~/.motion-studio/sfx` and kept when the skill updates.

## Use it
Just ask, for example:

> Use motion-studio to make a 15-second promo for my app "Nova", dark style.

> Use motion-studio to make a real estate reel from this video. Agent: Amara Cole, Coastline Realty.
> $1.25M, 4 bed, 3 bath, 14 Harbor View Drive. Photos attached. CTA: comment TOUR.

Then tweak in plain words: "make the green our brand blue", "use these keywords instead", "drop the map".

## Updates
- **Claude Code / desktop:** `/plugin marketplace update bigmo-skills` (or turn on auto-update for this
  marketplace in `/plugin`). Then ask Claude to run `scripts/get_sounds.py` again if the update notes mention new sounds.
- **claude.ai:** download the new zip from Releases and upload it again (replacing the old one).
- **What changed:** every release lists it, and so does [CHANGELOG.md](CHANGELOG.md). Click **Watch → Custom → Releases**
  at the top of this page to get an email when a new version comes out.

## For the maintainer: publishing an update
1. Change the skill in `plugins/motion-studio/skills/motion-studio/`.
2. Bump the version in three places: `plugins/motion-studio/.claude-plugin/plugin.json`,
   `.claude-plugin/marketplace.json`, and the `Version` line at the top of `SKILL.md`.
3. Add a section at the top of `CHANGELOG.md`.
4. Commit and push, then on GitHub: **Releases → Draft a new release**, tag `v1.1.0`, **Publish**.
   GitHub Actions attaches the zip and fills the notes from the changelog (it fails loudly if the three version numbers don't match the tag).

## Layout
```
.claude-plugin/marketplace.json          marketplace "bigmo-skills"
plugins/motion-studio/.claude-plugin/    plugin manifest (version)
plugins/motion-studio/skills/motion-studio/
  SKILL.md        what Claude reads
  assets/         motion.js runtime, fonts, person-segmentation models, sound list
  examples/       templates (promo, landscape launch film, real estate talking head)
  references/     style, motion, scene, sound and talking-head rules
  scripts/        render.mjs, sfx.py, get_sounds.py, transcribe.py, matte.py
```

Fonts are under the SIL Open Font License (see each font folder). Segmentation models are MediaPipe (Apache 2.0).
