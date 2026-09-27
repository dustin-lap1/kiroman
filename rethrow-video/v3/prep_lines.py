# trim silence on each Chatterbox line, verify with Whisper, report mismatches
import json,glob,os,re,numpy as np,soundfile as sf,sys
from faster_whisper import WhisperModel
os.makedirs('v3/lines_trim',exist_ok=True)
S=json.load(open('v3/script.json'))
m=WhisperModel('small.en',device='cpu',compute_type='int8')
norm=lambda t:re.sub(r'[^a-z0-9 ]','',t.lower().replace('-',' ')).split()
bad=[]
for s in S:
    for i,(show,say) in enumerate(s['lines']):
        k=f"{s['id']}_{i:02d}"; f=f'v3/lines/{k}.wav'
        if not os.path.exists(f): continue
        a,sr=sf.read(f); env=np.convolve(np.abs(a),np.ones(480)/480,'same'); nz=np.where(env>0.006)[0]
        a=a[max(0,nz[0]-int(.03*sr)):nz[-1]+int(.12*sr)]
        fade=int(.01*sr); a[:fade]*=np.linspace(0,1,fade); a[-fade:]*=np.linspace(1,0,fade)
        sf.write(f'v3/lines_trim/{k}.wav',a,sr)
        segs,_=m.transcribe(f'v3/lines_trim/{k}.wav',beam_size=5)
        got=' '.join(x.text for x in segs).strip()
        import difflib
        J=lambda t:''.join(norm(t))
        r=max(difflib.SequenceMatcher(None,J(got),J(x)).ratio() for x in [show,say or show])
        miss=[]
        flag='' if r>=0.86 else 'CHECK'
        if flag: bad.append(k)
        print(f"{k} {len(a)/sr:5.1f}s {r:.2f} {flag} | {got}" + (f"  [missing: {' '.join(miss)}]" if miss else ''))
print('FLAGGED',','.join(bad))
