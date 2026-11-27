#!/usr/bin/env node
/**
 * render.mjs: turn a motion.js scene (HTML) into an MP4, frame by frame.
 *
 *   node render.mjs scene.html [--out video.mp4] [--fps 30] [--no-audio]
 *        [--background footage.mp4]   real video underneath (talking head, tour); its voice is kept
 *        [--music track.mp3]          the user's own music; ducked automatically under the voice
 *        [--sfx-gain 0.55] [--music-gain 0.12]
 *        [--stills 0.5,3,7.2] [--stills-dir ./checks]
 *
 * Needs: Node 18+, Playwright (npm i -D playwright && npx playwright install chromium),
 *        ffmpeg on PATH, python3 + numpy for sound (skipped with --no-audio).
 * Set CHROMIUM_PATH to use an existing Chromium/Chrome binary.
 *
 * --stills only exports PNG check frames at the given seconds (fast; use while iterating).
 */
import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = args[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};
const input = args.find(a => !a.startsWith('--') && /\.html?$/.test(a));
if (!input) { console.error('usage: node render.mjs scene.html [--out video.mp4] [--background footage.mp4] [--music track.mp3] [--no-audio] [--stills 1,2,3]'); process.exit(1); }

const htmlPath = resolve(input);
const out = resolve(flag('out', htmlPath.replace(/\.html?$/, '.mp4')));

let playwright;
try { playwright = createRequire(import.meta.url)('playwright'); }
catch { playwright = await import('playwright').then(m => m.default || m).catch(() => null); }
if (!playwright) { console.error('Playwright not found. Run: npm i -D playwright && npx playwright install chromium'); process.exit(1); }

const launchOpts = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
const browser = await playwright.chromium.launch(launchOpts);
const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
page.on('pageerror', e => console.error('[page error]', e.message));
// ---- optional real footage underneath (talking head, property tour...) ----
const bgVideo = flag('background', null) ? resolve(flag('background')) : null;
const probe = f => JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type', '-of', 'json', f], { encoding: 'utf8' }).stdout || '{}');
let bgInfo = null;
if (bgVideo) {
  if (!existsSync(bgVideo)) { console.error(`background not found: ${bgVideo}`); process.exit(1); }
  const p = probe(bgVideo);
  bgInfo = { duration: Number(p.format?.duration || 0), hasAudio: (p.streams || []).some(s => s.codec_type === 'audio') };
}

await page.goto(pathToFileURL(htmlPath).href + '?render=1' + (bgVideo ? '&overlay=1' : ''));
await page.waitForFunction(() => window.__ms && document.readyState === 'complete');
await page.evaluate(() => document.fonts && document.fonts.ready);
let cfg = await page.evaluate(() => window.__ms.config);
if (bgInfo && (!cfg.duration || cfg.duration === 'auto')) {
  await page.evaluate(d => { window.__ms.config.duration = d; }, bgInfo.duration);
  cfg = await page.evaluate(() => window.__ms.config);
}
if (!cfg.duration || cfg.duration === 'auto') { console.error('duration is "auto" but no --background video was given'); process.exit(1); }
const fps = Number(flag('fps', cfg.fps));
await page.setViewportSize({ width: cfg.width, height: cfg.height });

const stills = flag('stills', null);
if (stills) {
  // with --background, stills are composited over the matching video frame so you see the real result
  const dir = resolve(flag('stills-dir', join(dirname(out), basename(out, '.mp4') + '-checks')));
  mkdirSync(dir, { recursive: true });
  for (const s of String(stills).split(',').map(Number)) {
    await page.evaluate(t => window.__ms.seek(t), s);
    const png = join(dir, `t${s.toFixed(2)}.png`);
    if (!bgVideo) { await page.screenshot({ path: png }); continue; }
    const ov = png.replace(/\.png$/, '.overlay.png');
    await page.screenshot({ path: ov, omitBackground: true });
    spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(s), '-i', bgVideo, '-i', ov, '-filter_complex',
      `[0:v]scale=${cfg.width}:${cfg.height}:force_original_aspect_ratio=increase,crop=${cfg.width}:${cfg.height}[b];[b][1:v]overlay=0:0`, '-frames:v', '1', png], { stdio: 'inherit' });
    rmSync(ov);
  }
  console.log(`stills written to ${dir}`);
  await browser.close();
  process.exit(0);
}

const total = Math.round(cfg.duration * fps);
const silent = out.replace(/\.mp4$/, '.silent.mp4');
const enc = ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '18', '-movflags', '+faststart'];
const ffArgs = bgVideo
  ? ['-y', '-loglevel', 'error', '-i', bgVideo, '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
     '-filter_complex', `[0:v]scale=${cfg.width}:${cfg.height}:force_original_aspect_ratio=increase,crop=${cfg.width}:${cfg.height},fps=${fps},setsar=1[b];[b][1:v]overlay=0:0:eof_action=pass[v]`,
     '-map', '[v]', '-frames:v', String(total), ...enc, silent]
  : ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', ...enc, silent];
const ff = spawn('ffmpeg', ffArgs, { stdio: ['pipe', 'inherit', 'inherit'] });

const t0 = Date.now();
for (let i = 0; i < total; i++) {
  await page.evaluate(t => window.__ms.seek(t), i / fps);
  const buf = bgVideo ? await page.screenshot({ type: 'png', omitBackground: true }) : await page.screenshot({ type: 'jpeg', quality: 92 });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (i % fps === 0) process.stdout.write(`\rframe ${i}/${total}`);
}
ff.stdin.end();
await new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg failed')))));
const cues = await page.evaluate(() => window.__ms.cues);
await browser.close();
console.log(`\rrendered ${total} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

if (flag('no-audio', false)) { spawnSync('mv', [silent, out]); console.log(`done: ${out}`); process.exit(0); }

// ---- sound: effects + (voice from the footage) + (optional music, ducked under the voice) ----
const cuesPath = out.replace(/\.mp4$/, '.cues.json');
const wav = out.replace(/\.mp4$/, '.sfx.wav');
writeFileSync(cuesPath, JSON.stringify(cues, null, 1));
const py = spawnSync('python3', [join(here, 'sfx.py'), cuesPath, wav, '--duration', String(cfg.duration)], { stdio: 'inherit' });
if (py.status !== 0) { console.error('sound failed; keeping silent video'); spawnSync('mv', [silent, out]); process.exit(0); }

const music = flag('music', null) ? resolve(flag('music')) : null;
const sfxGain = Number(flag('sfx-gain', bgInfo?.hasAudio ? 0.55 : 1));   // effects sit under a voice
const musicGain = Number(flag('music-gain', bgInfo?.hasAudio ? 0.12 : 0.35));
const inputs = ['-i', silent, '-i', wav];
const parts = [`[1:a]volume=${sfxGain}[fx]`];
const mixIn = ['[fx]'];
let n = 2;
let voice = null;
if (bgInfo?.hasAudio) { inputs.push('-i', bgVideo); voice = `[${n}:a]`; parts.push(`${voice}aresample=48000,asplit=2[vo][vk]`); mixIn.push('[vo]'); n++; }
if (music) {
  if (!existsSync(music)) { console.error(`music not found: ${music}`); process.exit(1); }
  inputs.push('-stream_loop', '-1', '-i', music);
  parts.push(`[${n}:a]aresample=48000,volume=${musicGain},afade=t=in:d=0.6,afade=t=out:st=${Math.max(0, cfg.duration - 1.5)}:d=1.5[mu0]`);
  if (voice) { parts.push(`[mu0][vk]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[mu]`); }
  else { parts.push('[mu0]anull[mu]'); }
  mixIn.push('[mu]'); n++;
} else if (voice) { parts.push('[vk]anullsink'); }
parts.push(`${mixIn.join('')}amix=inputs=${mixIn.length}:normalize=0:duration=first,alimiter=limit=0.89[a]`);
const mux = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', parts.join(';'),
  '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', String(cfg.duration), out], { stdio: 'inherit' });
if (mux.status !== 0) process.exit(1);
for (const f of [silent, wav, cuesPath]) if (existsSync(f)) rmSync(f);
console.log(`done: ${out}`);
