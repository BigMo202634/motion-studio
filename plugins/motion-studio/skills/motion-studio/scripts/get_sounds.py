#!/usr/bin/env python3
"""
get_sounds.py: one-time download of the real sound effects (176 recordings from Mixkit and Pixabay).

  python3 get_sounds.py                 # into ~/.motion-studio/sfx (kept across skill updates)
  python3 get_sounds.py --dest DIR      # somewhere else (then set MOTION_STUDIO_SFX=DIR)

The sounds are free to use in videos (Mixkit Sound Effects Free License, Pixabay Content License) but may not be
redistributed as files, so they are not shipped in the skill: each user downloads them from the source.
Each file is trimmed of leading/trailing silence and capped like the curated library (needs ffmpeg).
Already-downloaded sounds are skipped, so re-running after an update only fetches new ones.
"""
import argparse, json, subprocess, sys, time, urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
LIST = HERE.parent / 'assets' / 'sfx' / 'sounds.json'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'


def fetch(url, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Referer': url.split('/download')[0].split('/active_storage')[0] + '/'})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception as e:
            if i == tries - 1: raise
            time.sleep(3 * (i + 1))


def process(raw, out, cap):
    """Trim silence at both ends, cap to the curated length with a short fade, 44.1k stereo mp3."""
    fade = 0.25 if cap > 1.5 else 0.03
    af = (f'silenceremove=start_periods=1:start_threshold=-50dB,areverse,'
          f'silenceremove=start_periods=1:start_threshold=-60dB,areverse,'
          f'atrim=0:{cap},afade=t=out:st={max(0, cap - fade)}:d={fade}')
    r = subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-y', '-i', str(raw), '-af', af,
                        '-ar', '44100', '-ac', '2', '-b:a', '160k', str(out)], capture_output=True, text=True)
    return r.returncode == 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dest', default=str(Path.home() / '.motion-studio' / 'sfx'))
    ap.add_argument('--delay', type=float, default=0.6, help='seconds between downloads (be polite to the hosts)')
    a = ap.parse_args()
    dest = Path(a.dest).expanduser()
    items = json.loads(LIST.read_text())
    done = skipped = 0; failed = []
    for name, url, source, cap in items:
        out = dest / f'{name}.mp3'
        if out.exists() and out.stat().st_size > 1000: skipped += 1; continue
        out.parent.mkdir(parents=True, exist_ok=True)
        raw = out.with_suffix('.raw.mp3')
        try:
            raw.write_bytes(fetch(url))
            if not process(raw, out, cap + 0.05): raise RuntimeError('ffmpeg failed')
            done += 1
            print(f'\r{done + skipped}/{len(items)} {name:<45}', end='', flush=True)
        except Exception as e:
            failed.append((name, str(e)))
        finally:
            raw.unlink(missing_ok=True)
        time.sleep(a.delay)
    cat = HERE.parent / 'assets' / 'sfx' / 'catalog.md'
    if cat.exists(): (dest / 'catalog.md').write_text(cat.read_text())
    print(f'\n{done} downloaded, {skipped} already there, {len(failed)} failed -> {dest}')
    for n, e in failed: print(f'  failed: {n} ({e})')
    if failed: print('Re-run the command to retry the failed ones.')
    sys.exit(1 if failed and not done and not skipped else 0)


if __name__ == '__main__':
    main()
