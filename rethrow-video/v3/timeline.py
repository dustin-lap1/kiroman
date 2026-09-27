import json, os, numpy as np, soundfile as sf
S=json.load(open("v3/script.json"))
pad={"intro":(1.8,0.8),"harness":(0.8,1.4),"principles":(0.8,1.2),"cta":(0.8,6.0),"name":(0.8,1.5),"founder":(0.8,1.0),"stats":(0.7,1.0),"questions":(0.7,1.2)}
t=0;sc=[];real=0
for s in S:
    lead,tail=pad.get(s["id"],(0.7,0.9)); lines=[];lt=0
    for i,(show,say) in enumerate(s["lines"]):
        f=f"v3/lines/{s['id']}_{i:02d}.flac"
        if os.path.exists(f): d=sf.info(f).duration; real+=1
        else: d=len(say or show)/15.5
        lines.append({"text":show,"t":round(lt,3),"d":round(d,3)})
        gap=0.18 if show.endswith((":",",")) else (0.3 if len(show)<25 else 0.45)
        lt+=d+gap
    audio=lt-gap; dur=lead+audio+tail
    sc.append({"id":s["id"],"start":round(t,3),"dur":round(dur,3),"lead":lead,"lines":lines,"gap":gap}); t+=dur
open("v3/timeline.js","w").write("window.TL="+json.dumps({"total":round(t,3),"scenes":sc})+";")
print("total",round(t,1),"real lines",real)
for s in sc: print(s["id"],s["start"],s["dur"])
