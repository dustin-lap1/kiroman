import json, os, re, time, torch, torchaudio as ta
from chatterbox.tts import ChatterboxTTS
torch.set_num_threads(4)
RESPELL=[(r"rethrow\.ai","Re-throw dot A-I"),(r"Rethrow's","Re-throw's"),(r"Rethrow","Re-throw"),(r"\brethrow\b","re-throw"),
 (r"\bA\.I\.","A-I"),(r"\bAI\b","A-I"),(r"Open A-I","Open A-I"),(r"OpenAI","Open A-I"),(r"Kiro\b","Keero"),(r"Base44","Base forty-four"),(r"Replit","Rep-lit"),
 (r"Gemini CLI","Gemini C-L-I"),(r"CLI streaming","C-L-I streaming"),(r"Karpathy","Kar-pathy"),(r"re-Invent","re-Invent")]
def respell(t):
    for a,b in RESPELL: t=re.sub(a,b,t)
    return t
if __name__=="__main__":
    m=ChatterboxTTS.from_pretrained(device="cpu")
    S=json.load(open("v3/script.json"))
    only=os.environ.get("ONLY")
    for s in S:
        for i,(show,say) in enumerate(s["lines"]):
            key=f"{s['id']}_{i:02d}"
            if only and key not in only.split(","): continue
            out=f"v3/lines/{key}.wav"
            if os.path.exists(out) and not only: continue
            txt=respell(say or show)
            torch.manual_seed(int(os.environ.get("SEED","7"))+i)
            t0=time.time()
            wav=m.generate(txt,audio_prompt_path="v3/aud/kokoro_am_michael.wav",exaggeration=0.42,cfg_weight=0.5,temperature=0.7)
            ta.save(out,wav,m.sr)
            print(key,round(time.time()-t0,1),'s',round(wav.shape[1]/m.sr,1),'s |',txt,flush=True)
