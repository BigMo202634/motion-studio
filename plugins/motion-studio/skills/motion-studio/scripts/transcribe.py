#!/usr/bin/env python3
"""
transcribe.py: word-level timings for captions (feeds MS.captions).

  python3 transcribe.py footage.mp4 words.js [--model small] [--language en]
  python3 transcribe.py footage.mp4 words.js --script "Exact words they say..."   (no speech model: spreads
        the script over the speech in the clip, using ffmpeg silence detection; good enough for short clips)

Writes words.js (`window.WORDS = [{"text","start","end"}...]`, load it with <script src="words.js">)
and words.json next to it. Edit the text in words.json/words.js to fix spelling (names, street names,
prices) without touching the timings.

Speech models (first one found is used):
  pip install faster-whisper     (recommended; downloads the model on first run)
  pip install openai-whisper
"""
import argparse, json, re, subprocess, sys
from pathlib import Path


def duration(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
                         capture_output=True, text=True).stdout.strip()
    return float(out or 0)


def speech_spans(path, total):
    """Non-silent spans via ffmpeg silencedetect."""
    r = subprocess.run(['ffmpeg', '-nostdin', '-i', path, '-af', 'silencedetect=n=-32dB:d=0.35', '-f', 'null', '-'],
                       capture_output=True, text=True)
    starts = [float(x) for x in re.findall(r'silence_start: ([0-9.]+)', r.stderr)]
    ends = [float(x) for x in re.findall(r'silence_end: ([0-9.]+)', r.stderr)]
    sil = list(zip(starts, ends + [total] * (len(starts) - len(ends))))
    spans, cur = [], 0.0
    for s, e in sil:
        if s - cur > 0.2: spans.append((cur, s))
        cur = e
    if total - cur > 0.2: spans.append((cur, total))
    return spans or [(0.0, total)]


def from_script(path, script):
    total = duration(path)
    words = script.split()
    spans = speech_spans(path, total) if has_audio(path) else [(0.3, total - 0.3)]
    span_len = sum(e - s for s, e in spans)
    weights = [max(len(re.sub(r'\W', '', w)), 2) + (3 if re.search(r'[.!?,]$', w) else 0) for w in words]
    unit = span_len / sum(weights)
    out, si, pos = [], 0, spans[0][0]
    for w, wt in zip(words, weights):
        d = wt * unit
        while si < len(spans) and pos + d * 0.5 > spans[si][1]:
            si += 1
            if si < len(spans): pos = spans[si][0]
        out.append({'text': w, 'start': round(pos, 3), 'end': round(pos + d * 0.92, 3)})
        pos += d
    return out


def has_audio(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', path],
                       capture_output=True, text=True)
    return bool(r.stdout.strip())


def from_model(path, model, language):
    try:
        from faster_whisper import WhisperModel
        m = WhisperModel(model, compute_type='int8')
        segs, _ = m.transcribe(path, word_timestamps=True, language=language, vad_filter=True)
        return [{'text': w.word.strip(), 'start': round(w.start, 3), 'end': round(w.end, 3)} for s in segs for w in (s.words or []) if w.word.strip()]
    except ImportError:
        pass
    try:
        import whisper
        m = whisper.load_model(model)
        r = m.transcribe(path, word_timestamps=True, language=language)
        return [{'text': w['word'].strip(), 'start': round(w['start'], 3), 'end': round(w['end'], 3)} for s in r['segments'] for w in s.get('words', []) if w['word'].strip()]
    except ImportError:
        sys.exit('No speech model installed. Run: pip install faster-whisper   (or pass --script "the exact words")')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('footage'); ap.add_argument('out')
    ap.add_argument('--model', default='small'); ap.add_argument('--language', default=None)
    ap.add_argument('--script', default=None)
    a = ap.parse_args()
    words = from_script(a.footage, a.script) if a.script else from_model(a.footage, a.model, a.language)
    out = Path(a.out)
    out.with_suffix('.json').write_text(json.dumps(words, indent=1))
    out.with_suffix('.js').write_text('window.WORDS = ' + json.dumps(words) + ';\n')
    print(f'{len(words)} words -> {out.with_suffix(".js")} and {out.with_suffix(".json")}')


if __name__ == '__main__':
    main()
