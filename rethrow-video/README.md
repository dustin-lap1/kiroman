# Rethrow overview video (v3.1)

The source for the ~8-minute Rethrow AI product overview video. This folder is separate from the Kiroman game code.

Each scene is an HTML/CSS animation (`index.html`) whose state is a pure function of time `t`. Playwright renders it frame by frame and ffmpeg encodes the frames. Narration timing drives every animation cue through `v3/timeline.js`.

## Layout
| Path | What it is |
|---|---|
| `index.html` | All 16 scenes and their renderers (reads `v3/timeline.js`) |
| `assets/` | Brand kit, partner and cloud logos, product screenshots, founder photos |
| `v3/script.json` | Narration: `[on-screen text, spoken text override]` per line |
| `v3/lines/*.flac` | The current narration, one file per line (Chatterbox voice). Replace these to re-voice. |
| `v3/timeline.py` | Builds `v3/timeline.js` from the line durations plus the per-scene lead and tail padding |
| `v3/music.py` | Synthesizes the music bed (116 BPM), places the voice lines, ducks the music and writes `v3/mix_raw.wav` and `v3/music_raw.wav` |
| `v3/tts_cb.py` | The Chatterbox TTS generator used for v3, including the respelling map (e.g. Rethrow → "Re-throw") |
| `v3/prep_lines.py` | Trims each line and checks it with Whisper (fuzzy match) |
| `render.mjs` / `still.mjs` | The parallel frame renderer and a preview-still helper |
| `deliverables/` | Captions (.srt), YouTube description with chapters, script, and the prompt PDF |

## Pipeline
```bash
# 1. voice lines -> v3/lines/<scene>_<nn>.flac   (see "Re-voicing with ElevenLabs")
python3 v3/timeline.py                       # durations -> v3/timeline.js
python3 v3/music.py                          # music + voice mix
ffmpeg -i v3/mix_raw.wav -af loudnorm=I=-14:TP=-1.5:LRA=11 -ar 48000 v3/mix_norm.wav
T=$(python3 -c "import re;print(re.search(r'\"total\": ([0-9.]+)',open('v3/timeline.js').read()).group(1))")
for i in 0 1 2 3; do SEGDIR=segs node render.mjs $i 4 $T & done; wait   # ~25 min on 4 CPUs
printf "file 'segs/seg%d.mp4'\n" 0 1 2 3 > list.txt
ffmpeg -f concat -safe 0 -i list.txt -i v3/mix_norm.wav -map 0:v -map 1:a -c:v libx264 -crf 20 -c:a aac -b:a 192k -movflags +faststart out.mp4
```
Requirements: Node with `playwright` (Chromium), ffmpeg with libx264, and Python with numpy, scipy and soundfile (plus faster-whisper for QA). In sandboxed environments, add the proxy CA to Chromium's NSS store (`certutil -A -d sql:$HOME/.pki/nssdb -n proxy -t "C,," -i <ca.crt>`). `mkdir -p segs` before rendering.

## Re-voicing with ElevenLabs (next step)
`v3/tts_eleven.py` does this. It reads the key from `ELEVENLABS_API_KEY` (or `ElevenLabs`, the name used in the cloud environment; environment variables only reach sessions started after they are added). It then finds the custom voice named **"Dustin"** via `GET /v1/voices` and voices each line in `v3/script.json`, using the spoken override where there is one.
```bash
python3 v3/tts_eleven.py                     # raw lines -> v3/lines_el/<scene>_<nn>.flac (ONLY=key,key to redo)
python3 v3/prep_lines.py v3/lines_el v3/lines_trim   # trim silence + Whisper check; review FLAGGED lines
cp v3/lines_trim/*.flac v3/lines/            # then run the pipeline above
```
- The pronunciation rules live in the `RESPELL` map in `tts_eleven.py`: Rethrow = "Re-throw"; Andrej = "On-dray"; Kiro = "Keer-oh"; Base44 = "Base forty-four"; Replit = "Rep-lit". Acronyms are spelled out in `script.json` (Amazon Web Services, Agent Client Protocol…) except AI and CLI. Years and prices are written as words.
- Changing line lengths only shifts `v3/timeline.js`; the animations re-cue automatically.

Pricing, features and agent availability shown in the video are subject to change before launch.
