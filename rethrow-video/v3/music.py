import numpy as np, json, re, subprocess, soundfile as sf
from scipy.signal import butter, sosfilt
SR=48000
TL=json.loads(re.search(r'window.TL=(.*);',open('v3/timeline.js').read()).group(1))
TOT=TL['total']; N=int(TOT*SR)+SR; t=np.arange(N)/SR
rng=np.random.default_rng(11)
st={s['id']:s['start'] for s in TL['scenes']}
mtof=lambda m:440*2**((m-69)/12)
BPM=116; beat=60/BPM; bar=4*beat
# A major: A  E  F#m  D  (I V vi IV)
chords=[[57,61,64,69],[56,59,64,68],[57,61,66,69],[57,62,66,69]]
roots=[45,40,42,38]
def lp(x,fc): return sosfilt(butter(2,fc,btype='low',fs=SR,output='sos'),x)
def hp(x,fc): return sosfilt(butter(2,fc,btype='high',fs=SR,output='sos'),x)
def bp(x,lo,hi): return sosfilt(butter(2,[lo,hi],btype='band',fs=SR,output='sos'),x)
# section intensity (0..1) for each layer
def env(points): xs,ys=zip(*points); return np.interp(t,xs,ys)
S=st
E=lambda a,b:(S[a]+(b if b>=0 else 0))
kick_on=env([(0,0),(S['stats']-.05,0),(S['stats'],.55),(S['cliff']-bar,.55),(S['cliff'],0),(S['name']-.05,0),(S['name'],.6),(S['bridge'],1),(S['principles'],1),(S['principles']+0.01,.7),(S['organize'],1),(S['founder']-bar,1),(S['founder'],0),(S['cta'],0),(S['cta']+0.01,1),(TOT-4,1),(TOT-3.5,0),(TOT+2,0)])
clap_on=env([(0,0),(S['migrate'],0),(S['migrate']+0.01,1),(S['principles'],1),(S['principles']+.01,.5),(S['organize'],1),(S['founder']-bar,1),(S['founder'],0),(S['cta']+4*bar,0),(S['cta']+4*bar+0.01,1),(TOT-4,1),(TOT-3.5,0),(TOT+2,0)])
bass_on=env([(0,0),(S['stats']-.05,0),(S['stats'],.6),(S['cliff'],.4),(S['name'],.8),(S['bridge'],1),(S['founder'],.5),(S['cta'],1),(TOT-3,0),(TOT+2,0)])
hat_on=env([(0,0),(S['stats'],.6),(S['cliff'],.3),(S['name'],.8),(S['bridge'],1),(S['founder'],.4),(S['cta'],1),(TOT-3,0),(TOT+2,0)])
bright=env([(0,0.5),(S['cliff'],0.3),(S['bridge']-0.5,0.35),(S['bridge']+0.5,1),(TOT+2,1)])
beats=np.arange(0,TOT+bar,beat)
# sidechain pump envelope
pump=np.ones(N)
for b in beats:
    i0=int(b*SR); n=int(0.32*SR); i1=min(N,i0+n)
    if i0>=N: break
    k=kick_on[i0]
    pump[i0:i1]=np.minimum(pump[i0:i1],1-0.55*k*np.exp(-np.arange(i1-i0)/SR*9))
L=np.zeros(N);R=np.zeros(N)
def add(sig,i0,g=1.0,pan=0.5):
    i1=min(N,i0+len(sig));
    if i0>=N: return
    L[i0:i1]+=sig[:i1-i0]*g*(1-pan)*2**.5; R[i0:i1]+=sig[:i1-i0]*g*pan*2**.5
# pad (saw-ish additive, detuned), chord per bar
pad=np.zeros((2,N))
for k in range(int(TOT/bar)+2):
    c=chords[k%4]; s0=k*bar; i0=int(max(0,s0-0.05)*SR); i1=min(N,int((s0+bar+0.3)*SR))
    if i0>=N: break
    tt=t[i0:i1]-s0; e=np.clip((tt+0.05)/0.25,0,1)*np.clip((bar+0.3-tt)/0.35,0,1)
    for j,m in enumerate(c):
        f=mtof(m)
        for ch,det in ((0,0.997),(1,1.003)):
            w=sum(np.sin(2*np.pi*f*det*h*tt+j*h)/h for h in range(1,8))
            pad[ch,i0:i1]+=w*e*0.035
padL=lp(pad[0],900+2600*0);padR=lp(pad[1],900)
padbr=hp(pad[0]+pad[1],1500)*0.25
L+= (padL+padbr*bright*0.5)*pump; R+=(padR+padbr*bright*0.5)*pump
# pluck arp: 16th syncopated pattern
e16=beat/4; patt=[1,0,1,1,0,1,0,1,1,0,1,0,0,1,1,0]; tones=[0,2,1,3,2,0,3,1]
k=0;x=S['cliff']*0+1.0
while x<TOT-2.5:
    step=int(round(x/e16))%16
    if patt[step]:
        c=chords[int(x//bar)%4]; m=c[tones[k%8]]+12+(12 if step in (2,10) else 0); f=mtof(m)
        n=int(0.35*SR); tt=np.arange(n)/SR
        w=(np.sign(np.sin(2*np.pi*f*tt))*0.35+np.sin(2*np.pi*f*tt))*np.exp(-tt*16)
        add(w,int(x*SR),0.028*(0.6+0.4*bright[int(x*SR)]),0.3 if k%2 else 0.7); k+=1
    x+=e16
# bass: offbeat 8ths
x=0.0
while x<TOT:
    for off in (beat/2,1.5*beat,2.5*beat,3.5*beat):
        s=x+off; i=int(s*SR)
        if i>=N: break
        g=bass_on[i]
        if g<=0.01: continue
        f=mtof(roots[int(s//bar)%4]); n=int(0.22*SR); tt=np.arange(n)/SR
        w=np.tanh(2*np.sin(2*np.pi*f*tt))*np.exp(-tt*10)*np.clip(tt/0.004,0,1)
        add(lp(w,700),i,0.09*g)
    x+=bar
# kick
for b in beats:
    i=int(b*SR)
    if i>=N: break
    g=kick_on[i]
    if g<=0.01: continue
    n=int(0.3*SR); tt=np.arange(n)/SR; ph=2*np.pi*np.cumsum(48+110*np.exp(-tt*38))/SR
    add(np.sin(ph)*np.exp(-tt*10),i,0.16*g)
# clap on 2 & 4
for bi,b in enumerate(beats):
    if bi%4 not in (1,3): continue
    i=int(b*SR)
    if i>=N: break
    g=clap_on[i]
    if g<=0.01: continue
    n=int(0.18*SR); tt=np.arange(n)/SR; nz=rng.standard_normal(n)
    e=np.exp(-tt*30)+0.6*np.exp(-np.maximum(tt-0.012,0)*30)*(tt>0.012)
    add(bp(nz*e,900,4000),i,0.05*g)
# hats offbeat + 16th shaker
for bi,b in enumerate(beats):
    for off,gg in ((beat/2,1.0),(beat/4,0.35),(3*beat/4,0.35)):
        i=int((b+off)*SR)
        if i>=N: continue
        g=hat_on[i]
        if g<=0.01: continue
        n=int(0.05*SR); tt=np.arange(n)/SR
        add(hp(rng.standard_normal(n),7000)*np.exp(-tt*(70 if gg==1 else 110)),i,0.035*g*gg,0.6 if gg==1 else 0.4)
# swells (noise risers) into bridge, harness, cta
for s in (S['stats'],S['name'],S['bridge'],S['harness'],S['principles'],S['cta']):
    d=2*bar/2; i0=int((s-d)*SR); n=int(d*SR); tt=np.arange(n)/n
    w=hp(rng.standard_normal(n),2500)*tt**2.2; add(w,i0,0.05)
    # soft impact
    n2=int(1.2*SR); tt2=np.arange(n2)/SR; add(lp(rng.standard_normal(n2),3000)*np.exp(-tt2*4),int(s*SR),0.02)
M=np.stack([L,R],1)
M=np.tanh(M*1.2)/1.2
fade=np.clip(t/1.5,0,1)*np.clip((TOT-t)/3.0,0,1); M*=fade[:,None]; M/=np.abs(M).max()
# voice
V=np.zeros(N)
for sc in TL['scenes']:
    for i,l in enumerate(sc['lines']):
        f=f"v3/lines/{sc['id']}_{i:02d}.flac"
        subprocess.run(['ffmpeg','-y','-loglevel','error','-i',f,'-ar',str(SR),'-ac','1','/tmp/claude-0/_l48.wav'],check=True)
        a_,_=sf.read('/tmp/claude-0/_l48.wav'); i0=int((sc['start']+sc['lead']+l['t']-(0.30 if (sc['id']=='intro' and i==0) else 0))*SR); V[i0:i0+len(a_)]+=a_[:N-i0]
V/=np.abs(V).max()
e=np.convolve(np.abs(V),np.ones(2400)/2400,'same'); e=np.clip(e/0.08,0,1)
# smooth (attack .08 release .5) via downsampled loop
h=240; es=e[::h]; g=np.zeros_like(es); a1=np.exp(-h/(0.08*SR)); r1=np.exp(-h/(0.5*SR)); cur=0
for i,v in enumerate(es):
    c=a1 if v>cur else r1; cur=c*cur+(1-c)*v; g[i]=cur
duck=1-0.45*np.repeat(g,h)[:N]
mix=M*duck[:,None]*0.20+np.stack([V,V],1)*0.9
sf.write('v3/mix_raw.wav',mix.astype(np.float32),SR); sf.write('v3/music_raw.wav',(M*0.5).astype(np.float32),SR)
print('ok',TOT)
