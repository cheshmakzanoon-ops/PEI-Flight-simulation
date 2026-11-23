#!/usr/bin/env python3
"""Recreate the scoped OGL North Cape source rows and metric runtime anchor table."""
import argparse
import hashlib
import json
from pathlib import Path

import openpyxl

def main():
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument('workbook',type=Path)
    cli.add_argument('--receipt',type=Path,default=Path('data/north-cape/locations.json'))
    cli.add_argument('--out',type=Path,default=Path('src/render/north-cape.generated.ts'))
    cfg=cli.parse_args()
    receipt=json.loads(cfg.receipt.read_text())
    sha=hashlib.sha256(cfg.workbook.read_bytes()).hexdigest()
    if sha!=receipt['sha256'] or cfg.workbook.stat().st_size!=receipt['sourceByteLength']:
        raise SystemExit('North Cape source workbook does not match the recorded hash and length.')
    book=openpyxl.load_workbook(cfg.workbook,read_only=True,data_only=True)
    rows=[]
    for k,row in enumerate(book[receipt['sourceWorksheet']].values,1):
        if row[:2]!=(receipt['sourceProvince'],receipt['sourceProject']):
            continue
        _,_,_,ident,number,_,kw,rotor,hub,mfg,model,year,lat,lon,_=row
        rows.append(dict(sourceRow=k,sourceTurbineId=ident,sourceTurbineOrdinal=number,longitude=lon,latitude=lat,
                         hubHeightM=hub,rotorDiameterM=rotor,unitNameplateKW=kw,manufacturer=mfg,model=model,commissioned=year))
    book.close()
    if rows!=receipt['turbines']:
        raise SystemExit('North Cape source rows changed. Review attribution and placement rather than silently regenerating.')
    tuples=[[row['sourceTurbineId'],row['longitude'],row['latitude']] for row in rows]
    text='// See data/north-cape/locations.json for scoped public coordinates and provenance.\nexport const NORTH_CAPE_V47 = [\n'
    text+=''.join(' '+json.dumps(row,separators=(',',':'))+',\n' for row in tuples)
    cfg.out.write_text(text+'] as const;\n')

if __name__=='__main__':
    main()
