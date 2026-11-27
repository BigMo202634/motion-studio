#!/usr/bin/env python3
"""
sfx.py: mix sound effects onto a timeline.

Usage:
  python3 sfx.py cues.json out.wav [--duration 15] [--library ../assets/sfx]

cues.json is a list of {"at": seconds, "sfx": name, "gain": 0..1}.

`name` is resolved in this order:
  1. a real recorded file in the library: "whoosh/whoosh_cinematic_fast" (see assets/sfx/catalog.md)
  2. a short alias that maps to a good default recording (ALIASES below): whoosh, pop, click, ding, ...
  3. a synthesized fallback (only if the library is missing).
Music is not generated here: pass the user's own track to render.mjs with --music.

Needs numpy, and ffmpeg to decode the recordings. Output: 48 kHz, 16-bit stereo WAV.
"""
import json, sys, wave, argparse, subprocess, os
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
def _default_lib():
    # 1. MOTION_STUDIO_SFX  2. assets/sfx inside the skill (if it holds sounds)  3. ~/.motion-studio/sfx (get_sounds.py)
    import os
    if os.environ.get('MOTION_STUDIO_SFX'): return Path(os.environ['MOTION_STUDIO_SFX']).expanduser()
    local = HERE.parent / 'assets' / 'sfx'
    if any(local.rglob('*.mp3')): return local
    return Path.home() / '.motion-studio' / 'sfx'


DEFAULT_LIB = _default_lib()

# Short names -> default real recording (relative to the library, no extension)
ALIASES = {
    'whoosh': 'whoosh/whoosh_cinematic_fast',
    'swoosh': 'whoosh/swoosh_quick_accent',
    'swoosh-down': 'whoosh/sweep_fast_air',
    'transition': 'whoosh/tech_transition_slide',
    'pop': 'pop/pop_message',
    'click': 'ui/click_select',
    'tap': 'ui/click_interface_tone',
    'tick': 'timer/tick_clock_single',
    'type': 'typing/type_single_key',
    'riser': 'riser/riser_cinematic_trailer',
    'ding': 'ding/ding_correct_answer',
    'success': 'ding/success_software_tone',
    'impact': 'impact/impact_quick_zoom',
    'boom': 'impact/impact_cinematic_deep_whoosh',
    'glitch': 'glitch/glitch_short',
    'sparkle': 'magic/magic_fairy_sparkle',
    'coins': 'money/cash_clinking_coins',
    'shutter': 'camera/camera_shutter_click',
    'counter-tick': 'counter/tick_single',
    'counter-land': 'counter/collect_points',
    'points': 'counter/xp_gain',
    'cash-register': 'money/cash_register_kaching',
    'notification': 'alert/notification_040',
    'error': 'alert/error_notification',
    'level-up': 'alert/level_up',
    'tada': 'alert/tada_fanfare',
    'applause': 'crowd/applause_cheer',
    'cheer': 'crowd/crowd_cheer',
    'drum-roll': 'riser/drum_roll',
    'bass-drop': 'impact/bass_drop',
    'logo': 'impact/logo_reveal_clean',
    'scroll': 'ui/scroll_ui_up',
    'vibrate': 'ui/phone_vibration',
    'heartbeat': 'fx/heartbeat',
}
_cache = {}


def load_recording(name, lib):
    """Decode a library file to float32 stereo at SR with ffmpeg. Returns (n,2) array or None."""
    key = (name, str(lib))
    if key in _cache: return _cache[key]
    path = None
    for ext in ('.wav', '.mp3', '.ogg', '.m4a', '.flac'):
        cand = Path(lib) / (name + ext)
        if cand.exists(): path = cand; break
    if path is None:
        _cache[key] = None; return None
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    a = np.frombuffer(raw, dtype='<f4').reshape(-1, 2).astype(np.float64)
    _cache[key] = a
    return a

SR = 48000
rng = np.random.default_rng(7)


def env(n, attack, release, curve=3.0):
    a = max(1, int(attack * SR)); r = max(1, int(release * SR))
    e = np.ones(n)
    e[:a] = np.linspace(0, 1, a)
    if r < n:
        e[-r:] = np.linspace(1, 0, r) ** curve
    return e


def lowpass(x, alpha):
    # one-pole lowpass; alpha can be an array (time-varying cutoff)
    y = np.empty_like(x); acc = 0.0
    a = np.broadcast_to(alpha, x.shape)
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc); y[i] = acc
    return y


def whoosh(dur=0.45, down=False):
    n = int(dur * SR); noise = rng.standard_normal(n)
    sweep = np.linspace(0.02, 0.35, n) if not down else np.linspace(0.35, 0.02, n)
    bp = lowpass(noise, sweep) - lowpass(noise, sweep * 0.25)
    shape = np.sin(np.linspace(0, np.pi, n)) ** 1.6
    return bp * shape * 2.2


def pop(dur=0.12):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 900 * np.exp(-t * 28) + 260
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * env(n, 0.002, dur * 0.9) * 0.8


def click(dur=0.03):
    n = int(dur * SR)
    return rng.standard_normal(n) * np.exp(-np.arange(n) / (SR * 0.004)) * 0.6


def tick(dur=0.05):
    n = int(dur * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 90) * 0.35


def type_key():
    return click(0.03) * 0.5 + tick(0.03) * 0.2


def riser(dur=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 220 * (2 ** (t / dur * 2))
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25
    noise = lowpass(rng.standard_normal(n), np.linspace(0.01, 0.3, n)) * 0.8
    return (tone + noise) * (t / dur) ** 2


def ding(dur=1.2):
    n = int(dur * SR); t = np.arange(n) / SR
    out = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * d)
              for f, a, d in [(1318.5, 0.5, 4), (2637, 0.2, 7), (1975.5, 0.15, 6), (3950, 0.06, 10)])
    return out * env(n, 0.003, 0.2, 1)


def impact(dur=0.6):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 120 * np.exp(-t * 8) + 42
    thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    crack = lowpass(rng.standard_normal(n), 0.4) * np.exp(-t * 40) * 0.5
    return (thump + crack) * 0.9


SFX = {
    'whoosh': lambda: whoosh(), 'swoosh-down': lambda: whoosh(0.5, down=True),
    'pop': pop, 'click': click, 'tick': tick, 'riser': riser, 'ding': ding,
    'impact': impact, 'type': type_key,
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cues'); ap.add_argument('out')
    ap.add_argument('--duration', type=float, default=None)
    ap.add_argument('--library', default=str(DEFAULT_LIB))
    a = ap.parse_args()
    cues = json.load(open(a.cues))
    dur = a.duration or (max([c['at'] for c in cues] + [0]) + 2)
    n = int(dur * SR)
    L = np.zeros(n); R = np.zeros(n)
    used_synth = set()
    for i, c in enumerate(cues):
        name = c['sfx']
        gain = float(c.get('gain', 1))
        rec = load_recording(name, a.library)
        if rec is None and name in ALIASES:
            rec = load_recording(ALIASES[name], a.library)
        start = int(c['at'] * SR)
        if start >= n: continue
        if rec is not None:
            s = rec[: n - start] * gain
            L[start:start + len(s)] += s[:, 0]
            R[start:start + len(s)] += s[:, 1]
            continue
        if name not in SFX:
            print(f'unknown sfx "{name}" (not in library, no alias), skipped', file=sys.stderr); continue
        used_synth.add(name)
        s = SFX[name]() * gain
        s = s[: n - start]
        pan = 0.5 + 0.18 * np.sin(i * 1.7)
        L[start:start + len(s)] += s * (1 - pan) * 1.4
        R[start:start + len(s)] += s * pan * 1.4
    if used_synth:
        print(f'note: no recording found for {sorted(used_synth)}; used synthesized fallback. Run once: python3 scripts/get_sounds.py', file=sys.stderr)
    mix = np.stack([L, R], axis=1)
    peak = np.max(np.abs(mix)) or 1
    mix = mix / max(peak, 1.0) * 0.89
    with wave.open(a.out, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((mix * 32767).astype('<i2').tobytes())
    print(f'wrote {a.out} ({dur:.1f}s, {len(cues)} cues)')


if __name__ == '__main__':
    main()
