# usage (from rethrow-video/): python3 v3/retime_deliverables.py -- after timeline.py, re-times the .srt and chapter stamps
# re-time deliverables (srt cues + chapter stamps) against the current v3/timeline.js
import json,re,sys
from faster_whisper import WhisperModel
TL=json.loads(re.search(r'window.TL=(.*);',open('v3/timeline.js').read()).group(1))
srt=open('deliverables/rethrow-overview-v3.srt').read().strip().split('\n\n')
cues=[b.split('\n',2)[2].replace('\n',' ') for b in srt]
m=WhisperModel('small.en',device='cpu',compute_type='int8')
out=[];ci=0
nz=lambda s:re.sub(r'\s+',' ',s).strip()
for s in TL['scenes']:
    for i,L in enumerate(s['lines']):
        t0=s['start']+s['lead']+L['t']; text=nz(L['text'])
        chunks=[];acc='';c0=ci
        while ci<len(cues) and nz(acc)!=text and text.startswith(nz(acc+' '+cues[ci]).strip()):
            acc=(acc+' '+cues[ci]).strip(); chunks.append(cues[ci]); ci+=1
        if nz(acc)!=text:  # new or edited line: drop stale cues, split at punctuation into <=55-char chunks
            ci=c0
            while ci<len(cues) and not any(nz(l['text']).startswith(nz(cues[ci])) for sc2 in TL['scenes'] for l in sc2['lines']): ci+=1
            chunks=[];cur=''
            for part in re.split(r'(?<=[,.?:])\s+',text):
                if cur and len(cur)+len(part)>55: chunks.append(cur);cur=part
                else: cur=(cur+' '+part).strip()
            chunks.append(cur)
        segs,_=m.transcribe(f"v3/lines/{s['id']}_{i:02d}.flac",word_timestamps=True,beam_size=5)
        W=[w for sg in segs for w in sg.words]; tot=sum(len(w.word.strip()) for w in W)
        def at(frac):  # time at fraction of spoken chars
            c=0
            for w in W:
                n=len(w.word.strip())
                if c+n>=frac*tot: return w.end
                c+=n
            return L['d']
        pos=0
        for j,ch in enumerate(chunks):
            a=pos/len(text); pos+=len(ch)+1; b=min(1,pos/len(text))
            st=t0 if j==0 else t0+at(a)-0.15
            en=t0+L['d'] if j==len(chunks)-1 else t0+at(b)
            out.append((st,en,ch))

f=lambda x:f"{int(x//3600):02d}:{int(x%3600//60):02d}:{int(x%60):02d},{int(round(x%1*1000)) if round(x%1*1000)<1000 else 999:03d}"
open('deliverables/rethrow-overview-v3.srt','w').write('\n\n'.join(f"{k+1}\n{f(a)} --> {f(b)}\n{c}" for k,(a,b,c) in enumerate(out))+'\n')
st=[s['start'] for s in TL['scenes']]
for fn,pat in [('deliverables/youtube-description.txt',r'^\d+:\d\d(?= )'),('deliverables/script.md',r'(?<=^## )\d+:\d\d(?= ·)')]:
    lines=open(fn).read().split('\n');k=0
    for n,l in enumerate(lines):
        if re.search(pat,l): lines[n]=re.sub(pat,f"{int(st[k]//60)}:{int(st[k]%60):02d}",l);k+=1
    assert k==len(st),(fn,k); open(fn,'w').write('\n'.join(lines))
print('cues',len(out),'chapters',len(st))
