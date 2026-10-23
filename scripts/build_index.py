#!/usr/bin/env python3
"""Build a compact static house-size index for the site-visit calculator.

Sources (free, public, keyless, no owner names):
  King:  https://aqua.kingcounty.gov/extranet/assessor/Residential%20Building.zip  (EXTR_ResBldg.csv)
  Snoh:  https://www.arcgis.com/sharing/rest/content/items/3c5edc985cec4fba8b3938d16ed1d3c3/data (Improvement Records xlsx)
Output: out/{king,snoh}/<prefix>.json  -> {"PIN":[sqft_living, yr_built, bedrooms, stories, kind], ...}
Only values present in source are written; blanks/0 become null. Never invents values.
Usage: python3 scripts/build_index.py [--king EXTR_ResBldg.csv] [--snoh improvements.xlsx|.csv] [--out data/house-size]
"""
import csv, json, os, sys, argparse, collections, io, tempfile, zipfile, urllib.request
KC_URL="https://aqua.kingcounty.gov/extranet/assessor/Residential%20Building.zip"
SN_URL="https://www.arcgis.com/sharing/rest/content/items/3c5edc985cec4fba8b3938d16ed1d3c3/data"
def num(v):
    try:
        f=float(str(v).replace(',','').strip())
        return int(f) if f>0 else None
    except: return None
def king(path):
    if not path:
        z=zipfile.ZipFile(io.BytesIO(urllib.request.urlopen(KC_URL).read()))
        fh=io.TextIOWrapper(z.open('EXTR_ResBldg.csv'),encoding='latin-1')
    else: fh=open(path,encoding='latin-1')
    out={}
    for r in csv.DictReader(fh):
        pin=r['Major'].strip().zfill(6)+r['Minor'].strip().zfill(4)
        rec=[num(r['SqFtTotLiving']),num(r['YrBuilt']),num(r['Bedrooms']),num(r['Stories']),'res']
        # multiple buildings on one parcel: keep building 1, count others
        if pin in out: out[pin][5]=out[pin][5]+1; continue
        out[pin]=rec+[1]
    return {k:(v if v[5]>1 else v[:5]) for k,v in out.items()}
def snoh_rows(path):
    if path and path.endswith('.csv'):
        yield from csv.DictReader(open(path,encoding='utf-8',errors='replace')); return
    import openpyxl
    if not path:
        path=os.path.join(tempfile.gettempdir(),'snoh_impr.xlsx'); urllib.request.urlretrieve(SN_URL,path)
    ws=openpyxl.load_workbook(path,read_only=True).active
    it=ws.iter_rows(values_only=True); hdr=[str(h) for h in next(it)]
    for row in it: yield dict(zip(hdr,row))
def snoh(path):
    out={}
    for r in snoh_rows(path):
        pin=str(r['PIN'] or '').strip()
        if not pin: continue
        kind='res' if str(r.get('ImprType','')).upper().startswith(('DWELL','MH','MHOME')) else str(r.get('ImprType') or '').lower()[:12]
        rec=[num(r['FinSize']),num(r['YrBuilt']),num(r['NumBedRms']),num(r['Stories']),kind]
        if pin in out:
            # prefer a dwelling record over outbuildings/commercial
            if out[pin][4]!='res' and kind=='res': out[pin]=rec
            continue
        out[pin]=rec
    return out
def shard(d,outdir,plen):
    os.makedirs(outdir,exist_ok=True)
    g=collections.defaultdict(dict)
    for k,v in d.items(): g[k[:plen]][k]=v
    tot=0
    for p,m in g.items():
        s=json.dumps(m,separators=(',',':')); tot+=len(s)
        open(f'{outdir}/{p}.json','w').write(s)
    return len(g),tot
if __name__=='__main__':
    a=argparse.ArgumentParser(); a.add_argument('--king'); a.add_argument('--snoh'); a.add_argument('--out',default='out')
    a.add_argument('--skip-king',action='store_true'); a.add_argument('--skip-snoh',action='store_true'); o=a.parse_args()
    meta={}
    if not o.skip_king:
        k=king(o.king); n,t=shard(k,o.out+'/king',3); meta['king']=dict(parcels=len(k),shards=n,bytes=t,source=KC_URL)
    if not o.skip_snoh:
        s=snoh(o.snoh); n,t=shard(s,o.out+'/snoh',4); meta['snoh']=dict(parcels=len(s),shards=n,bytes=t,source=SN_URL)
    json.dump(meta,open(o.out+'/meta.json','w'),indent=1); print(json.dumps(meta,indent=1))
