#!/usr/bin/env python3
"""Acquire native-CRS public 2020 PEI hedgerow polygons without silently losing pages.

This is a reproducibility tool, not a runtime service. The caller must verify the
published snapshot receipt before baking material layers.
"""
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
import argparse
import gzip
import json
from pathlib import Path
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen

URL='https://gis.princeedwardisland.ca/server/rest/services/Hosted/CLUI2020_OpenData/FeatureServer/0/query'
FILTER="landuse = 'AGR' AND subuse = 'HR'"
FIELDS='objectid,fieldid,landuse,subuse,hectares,county,cover1,per1,cover2,per2,cover3,per3,cover4,per4,cover5,per5,height,crown'
BATCH=1500

def get(params):
    req=Request(URL+'?'+urlencode(params),headers={'User-Agent':'PEI Flight Sim / reproducible public scenery data','Accept-Encoding':'gzip'})
    for attempt in range(4):
        try:
            with urlopen(req,timeout=48) as res:
                body=res.read()
                if res.headers.get('Content-Encoding')=='gzip':body=gzip.decompress(body)
            data=json.loads(body)
            if 'error' in data:raise IOError(data['error'])
            return data
        except (OSError,ValueError):
            if attempt==3:raise
            time.sleep(1.5*2**attempt)

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--out',required=True,type=Path)
    out=p.parse_args().out
    out.mkdir(parents=True,exist_ok=True)
    ids=sorted(get(dict(where=FILTER,returnIdsOnly='true',f='json'))['objectIds'])
    n=get(dict(where=FILTER,returnCountOnly='true',f='json'))['count']
    if n != len(set(ids)) or len(ids)!=n:raise ValueError('Count and object-ID snapshot differ')
    if n!=13519:raise ValueError('Unexpectedly sparse province data')
    def page(start):
        subset=ids[start:start+BATCH]
        result=get(dict(where=FILTER,resultOffset=start,resultRecordCount=BATCH,outFields=FIELDS,
          returnGeometry='true',returnZ='false',returnM='false',outSR='2954',orderByFields='objectid ASC',f='json'))
        actual=sorted(result.pop('features'),key=lambda r:r['attributes']['objectid'])
        if [f['attributes']['objectid'] for f in actual]!=subset:
            raise ValueError('Partial or mismatched read at offset '+str(start))
        if result['spatialReference']['wkid'] not in (2954,2291) or any(not f.get('geometry',{}).get('rings') for f in actual):
            raise ValueError('Unexpected CRS/empty geometry')
        result['features']=actual
        raw=(json.dumps(result,ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n').encode()
        gz=gzip.compress(raw,compresslevel=7,mtime=0)
        name=f'hedgerow-{start:05}.json.gz'
        (out/name).write_bytes(gz)
        print(start,len(actual),len(gz),flush=True)
        return dict(name=name,count=len(actual),sha256=sha256(raw).hexdigest(),gzipBytes=len(gz))
    with ThreadPoolExecutor(max_workers=3) as pool:
        pages=list(pool.map(page,range(0,n,BATCH)))
    result=dict(url=URL,where=FILTER,fields=FIELDS,nativeEPSG=2954,count=n,
        objectIdsSHA256=sha256(','.join(map(str,ids)).encode()).hexdigest(),pages=pages)
    (out/'receipt.json').write_text(json.dumps(result,indent=2)+'\n')
if __name__=='__main__':main()
