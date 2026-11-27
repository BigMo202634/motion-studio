# Sound

Sound is half of "feels premium". Every visible event that has weight gets a cue, and nothing else does.
Add cues with `MS.cue(at, name, gain)`. The renderer mixes **real recorded effects** from the sound library (`~/.motion-studio/sfx`, filled once by `scripts/get_sounds.py`)
(176 real recordings from Mixkit and Pixabay, listed in `assets/sfx/catalog.md`). Use the full name (`'whoosh/whoosh_cinematic_fast'`)
for control, or a short alias (`'whoosh'`, `'pop'`, `'ding'`...) for the default pick.

| Moment | Use (library name) | Gain |
|---|---|---|
| Scene cut / big move in | `whoosh/whoosh_cinematic_fast`, `whoosh/swoosh_fast_transitions`, `whoosh/tech_transition_slide` | .6–.75 |
| Quick slide or swipe | `whoosh/swoosh_quick_accent`, `whoosh/sweep_fast_air`, `whoosh/swipe_fast_zoom` | .5–.7 |
| Chip, card, sticker pops in | `pop/pop_message`, `pop/pop_dry`, `pop/pop_bubble_alert`, `pop/pop_hard_click` | .35–.5 |
| Headline word slams in | `impact/impact_quick_zoom`, `impact/impact_short_bass`, `impact/impact_fast_blow` | .7–.9 |
| Logo / big reveal | `impact/impact_cinematic_deep_whoosh`, `impact/impact_movie_logo`, `impact/impact_trailer_whoosh_hit` | .6–.8 |
| Number lands, success, ✓ | `ding/ding_correct_answer`, `ding/success_software_tone`, `ding/ding_confirmation` | .45–.6 |
| Build-up before a payoff | `riser/riser_cinematic_trailer` (≈2s), `riser/riser_space_stutter` | .4–.55 |
| Button press, tap, toggle | `ui/click_select`, `ui/click_interface_tone`, `ui/click_light_switch`, `ui/ui_light_button` | .7–.9 |
| Typing | `typing/type_single_key` with every 3rd key `typing/type_key_press_laptop`, every .1–.12s | .45–.6 |
| **Number counter** (any `MS.count`) | `MS.countSound(at, dur, ease)` with the same timing: `counter/tick_single` ticks that speed up and slow down with the number, then a landing sound (`counter/collect_points`, `counter/point_smooth_beep`, `counter/xp_gain`, `alert/ding`) | ticks .45–.55, land .5–.6 |
| Money / revenue counter | `MS.countSound(..., { tick: 'counter/tick_checkbox', land: 'money/cash_register_kaching' })`, or `counter/money_counter_fast` / `counter/cash_counting_machine` under it | .4–.6 |
| Scroll-wheel / picker roll | `counter/picker_wheel_ticks`, `ui/scroll_wheel` | .5 |
| Countdown / timer | `counter/countdown_beep_short`, `counter/clock_ticking_down`, `timer/tick_clock_single`, `timer/timer_racing_countdown` | .4–.5 |
| Points / XP / score bar fills | `counter/xp_gain`, `counter/xp_gain_magic`, `counter/points_8bit` | .5 |
| Notification / message in | `alert/notification_040`, `alert/message_notification`, `whoosh/message_sent_swoosh` | .5 |
| Success / win / level up | `alert/success_chime_ui`, `alert/success_vibraphone`, `alert/level_up`, `alert/tada_fanfare` | .5–.6 |
| Error / wrong / before-state ✕ | `alert/error_notification`, `alert/error` | .5 |
| Celebration | `crowd/applause_cheer`, `crowd/crowd_cheer`, `crowd/party_horn`, `crowd/confetti_gift` | .4–.6 |
| Suspense / tension | `fx/heartbeat_cinematic`, `riser/drum_roll`, `impact/braam_dark` | .4–.6 |
| Phone moment | `ui/phone_vibration`, `ui/scroll_ui_up`, `ui/page_turn` | .5 |
| Bass drop / logo sting | `impact/bass_drop`, `impact/whoosh_deep_bass_drop`, `impact/logo_reveal_clean`, `impact/logo_reveal_intro` | .6–.8 |
| Money, sales, price | `money/cash_clinking_coins`, `money/cash_coin_win` | .5 |
| Screenshot / photo moment | `camera/camera_shutter_click` | .6 |
| Tech or AI glitch transition | `glitch/glitch_short`, `glitch/glitch_intro_text`, `glitch/glitch_digital_break` | .4–.6 |
| Sparkle / magic reveal | `magic/magic_sparkle_whoosh`, `magic/magic_fairy_sparkle`, `magic/magic_sweep_presentation` | .4–.6 |

Whooshes peak a little after they start, so start them **0.1s before** the cut. Pops, clicks and impacts go on the exact frame.
Vary the picks within one video (don't use the same pop 6 times in a row; alternate 2–3 variants).

Rules
- Put the cue on the frame the motion **starts** (for pops and whooshes) or **lands** (for impacts and dings).
- Never put more than 2 cues within 0.1s, except typing.
- Licence: Mixkit Sound Effects Free License and Pixabay Content License: free for commercial and personal videos, no credit needed. Don't redistribute the raw sound files on their own (for example, don't publish the skill's `assets/sfx` folder publicly as a sound pack).
- Every counter must have sound: never leave `MS.count` silent. A 0→38 count gets about one tick per value; big numbers (12,480) get 14–20 ticks.
- If the sound library is missing (run `scripts/get_sounds.py`), the renderer falls back to synthesized sounds and prints a warning; tell the user.
- No generated music. If the user wants music, they supply a track and you pass `--music track.mp3`: it fades in and out and ducks under the voice automatically.
- Over talking footage the effects are mixed at 0.55 by default (`--sfx-gain`) so they never fight the voice. Use fewer cues than in a pure animation: hits on overlays only, nothing under every caption.
- Check loudness: `ffmpeg -i video.mp4 -af volumedetect -f null -` should give max_volume between −3 and −0.5 dB.
