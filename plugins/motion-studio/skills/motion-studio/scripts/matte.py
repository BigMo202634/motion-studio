#!/usr/bin/env python3
"""
matte.py: cut the person out of every frame of the footage, for "text behind the person" captions.

  python3 matte.py footage.mp4 cutout/ [--fps 30] [--width 1080 --height 1920] [--model selfie|multiclass] [--feather 2]

Writes cutout/f_00000.webp, f_00001.webp... (the person in colour, everything else transparent), sized and
cropped exactly like render.mjs places the --background footage, plus cutout/info.json.
Put the folder next to the scene HTML and call  MS.cutout('#cutout', 'cutout')  in the timeline:
anything inside a `.ms-behind` layer is then drawn between the footage and the person.
Also writes cutout/cover.js (how much of each 40px row the person covers, per frame). Load it with
<script src="cutout/cover.js"> and MS.keywords places each word where it stays readable, or brings it
in front of the person when the head fills the frame.
  python3 matte.py footage.mp4 cutout/ --cover-only     (rebuild cover.js from existing frames)

Needs:  pip install mediapipe opencv-python-headless numpy pillow
Models: assets/models/selfie_segmenter.tflite (fast, default) and selfie_multiclass_256x256.tflite (better hair edges).
"""
import argparse, json, subprocess, sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
MODELS = {'selfie': HERE.parent / 'assets/models/selfie_segmenter.tflite',
          'multiclass': HERE.parent / 'assets/models/selfie_multiclass_256x256.tflite'}


def frames(path, fps, w, h):
    """Decode the footage with ffmpeg, scaled+cropped like render.mjs (cover), as RGB arrays."""
    vf = f'scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},fps={fps}'
    p = subprocess.Popen(['ffmpeg', '-nostdin', '-loglevel', 'error', '-i', path, '-vf', vf,
                          '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    n = w * h * 3
    while True:
        buf = p.stdout.read(n)
        if len(buf) < n: break
        yield np.frombuffer(buf, np.uint8).reshape(h, w, 3)
    p.wait()


ROW = 40


def cover_rows(alpha):
    """Fraction of each 40px row (x 60..W-60) covered by the person, 0..1."""
    h, w = alpha.shape
    a = alpha[:, 60:w - 60]
    return [round(float(a[y:y + ROW].mean()), 2) for y in range(0, h, ROW)]


def write_cover(out, fps, rows):
    (out / 'cover.js').write_text('window.MS_COVER = ' + json.dumps({'fps': fps, 'row': ROW, 'frames': rows}, separators=(',', ':')) + ';\n')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('footage'); ap.add_argument('out')
    ap.add_argument('--fps', type=float, default=30)
    ap.add_argument('--width', type=int, default=1080); ap.add_argument('--height', type=int, default=1920)
    ap.add_argument('--model', default='multiclass', choices=list(MODELS))
    ap.add_argument('--feather', type=float, default=2.0, help='edge softness in px')
    ap.add_argument('--quality', type=int, default=88)
    ap.add_argument('--cover-only', action='store_true')
    a = ap.parse_args()
    out = Path(a.out)
    if a.cover_only:
        from PIL import Image
        rows = [cover_rows(np.asarray(Image.open(f))[:, :, 3].astype(np.float32) / 255) for f in sorted(out.glob('f_*.webp'))]
        write_cover(out, a.fps, rows); print(f'{len(rows)} frames -> {out}/cover.js'); return
    try:
        import mediapipe as mp
        import cv2
        from PIL import Image
    except ImportError:
        sys.exit('Missing packages. Run: pip install mediapipe opencv-python-headless numpy pillow')
    model = MODELS[a.model]
    if not model.exists():
        sys.exit(f'model not found: {model}')

    BaseOptions = mp.tasks.BaseOptions
    vision = mp.tasks.vision
    opts = vision.ImageSegmenterOptions(base_options=BaseOptions(model_asset_path=str(model)),
                                        running_mode=vision.RunningMode.VIDEO, output_confidence_masks=True)
    out.mkdir(parents=True, exist_ok=True)
    rows = []
    for old in out.glob('f_*.webp'): old.unlink()
    prev = None
    i = 0
    with vision.ImageSegmenter.create_from_options(opts) as seg:
        for rgb in frames(a.footage, a.fps, a.width, a.height):
            # segment at a lower resolution (faster, same result), then upscale the mask
            small = cv2.resize(rgb, (a.width // 2, a.height // 2), interpolation=cv2.INTER_AREA)
            img = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(small))
            res = seg.segment_for_video(img, int(i * 1000 / a.fps))
            masks = res.confidence_masks
            if a.model == 'multiclass':   # class 0 = background
                m = 1.0 - masks[0].numpy_view().astype(np.float32)
            else:
                m = masks[0].numpy_view().astype(np.float32)
            m = cv2.resize(m.squeeze(), (a.width, a.height), interpolation=cv2.INTER_LINEAR)
            if prev is not None: m = 0.65 * m + 0.35 * prev   # temporal smoothing: no flicker on the edges
            prev = m
            alpha = np.clip((m - 0.35) / 0.3, 0, 1)            # tighten the soft mask into a clean edge
            if a.feather > 0: alpha = cv2.GaussianBlur(alpha, (0, 0), a.feather)
            rows.append(cover_rows(alpha))
            rgba = np.dstack([rgb, (alpha * 255).astype(np.uint8)])
            Image.fromarray(rgba, 'RGBA').save(out / f'f_{i:05d}.webp', quality=a.quality, method=4)
            i += 1
            if i % 30 == 0: print(f'\r{i} frames', end='', flush=True)
    write_cover(out, a.fps, rows)
    (out / 'info.json').write_text(json.dumps({'fps': a.fps, 'frames': i, 'width': a.width, 'height': a.height}))
    print(f'\r{i} frames -> {out}/')


if __name__ == '__main__':
    main()
