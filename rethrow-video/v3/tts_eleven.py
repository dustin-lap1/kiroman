# ElevenLabs TTS generator: voices every line of v3/script.json with the custom voice "Dustin".
# Raw lines go to v3/lines_el/<scene>_<nn>.flac; trim + QA them with prep_lines.py before use.
# Env: ELEVENLABS_API_KEY or ElevenLabs (required), VOICE (default "Dustin"), MODEL, ONLY=key1,key2 to redo lines.
import io, json, os, re, sys, time, urllib.request, urllib.error
import numpy as np, soundfile as sf

API = "https://api.elevenlabs.io/v1"
KEY = os.environ.get("ELEVENLABS_API_KEY") or os.environ.get("ElevenLabs") or sys.exit("set ELEVENLABS_API_KEY (or ElevenLabs)")
SR = 24000
OUT = "v3/lines_el"
RESPELL = [(r"rethrow\.ai", "Re-throw dot A.I."), (r"Rethrow's", "Re-throw's"), (r"Rethrow", "Re-throw"), (r"\brethrow\b", "re-throw"),
 (r"OpenAI", "Open A.I."), (r"Andrej", "On-dray"), (r"\bKiro\b", "Keer-oh"), (r"Base44", "Base forty-four"), (r"Replit", "Rep-lit"),
 (r"re-Invent", "ree-Invent")]

def respell(t):
    for a, b in RESPELL: t = re.sub(a, b, t)
    return t

def call(path, body=None, accept="application/json"):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body else None,
        headers={"xi-api-key": KEY, "Content-Type": "application/json", "Accept": accept})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=120) as r: return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and attempt < 4: time.sleep(2 ** attempt * 2); continue
            sys.exit(f"{path}: HTTP {e.code} {e.read()[:300]!r}")

def voice_id(name):
    vs = json.loads(call("/voices"))["voices"]
    hit = [v for v in vs if v["name"].strip().lower() == name.lower()] or [v for v in vs if v["name"].lower().startswith(name.lower())]
    if not hit: sys.exit(f"no voice named {name!r}; have: {', '.join(v['name'] for v in vs)}")
    print("voice", hit[0]["name"], hit[0]["voice_id"]); return hit[0]["voice_id"]

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    vid = voice_id(os.environ.get("VOICE", "Dustin"))
    only = os.environ.get("ONLY")
    for s in json.load(open("v3/script.json")):
        for i, (show, say) in enumerate(s["lines"]):
            key = f"{s['id']}_{i:02d}"; out = f"{OUT}/{key}.flac"
            if only and key not in only.split(","): continue
            if os.path.exists(out) and not only: continue
            txt = respell(say or show)
            pcm = call(f"/text-to-speech/{vid}?output_format=pcm_{SR}", {"text": txt, "model_id": os.environ.get("MODEL", "eleven_multilingual_v2"),
                "voice_settings": {"stability": 0.5, "similarity_boost": 0.8, "style": 0.0, "use_speaker_boost": True}}, accept="audio/pcm")
            a = np.frombuffer(pcm, dtype="<i2")
            sf.write(out, a, SR, subtype="PCM_16")
            print(key, round(len(a) / SR, 1), "s |", txt, flush=True)
