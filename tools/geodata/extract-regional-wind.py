#!/usr/bin/env python3
"""Rebuild the three small farm rosters from the exact OGL NRCan workbook; never infer missing units."""
import argparse,hashlib,json
from pathlib import Path
import openpyxl

def run(workbook,repo):
    source=json.loads((repo/'data/regional-wind/locations.json').read_text())
    if hashlib.sha256(workbook.read_bytes()).hexdigest()!=source['sourceWorkbookSHA256']:
        raise ValueError('Federal workbook revision changed; requalify individual rows before regeneration.')
    groups={entry['name']: key for key,entry in source['groups'].items()}
    book=openpyxl.load_workbook(workbook,read_only=True,data_only=True)
    included=[]; excluded=[]
    for i,row in enumerate(book['WTD'].values,1):
        if row[0]!='Prince Edward Island' or row[1] not in groups: continue
        unit={'row':i,'id':row[3],'farm':groups[row[1]],'longitude':row[13],'latitude':row[12],
              'rotorDiameterM':row[7],'federalHubM':row[8],'nominalKW':row[6],'model':row[10],'commissionYear':row[11]}
        if row[6]<=0: excluded.append({**unit,'reason':row[14]})
        else: included.append(unit)
    book.close()
    if included!=source['turbines'] or excluded!=source['explicitlyExcluded']:
        raise ValueError('Rows differ from the verified register.')
    text='// Generated from the exact NRCan workbook; see data/regional-wind/locations.json.\nexport const WIND_STATIONS={\n'
    for farm in source['groups']:
        text+=' '+json.dumps(farm)+':[\n'
        for u in included:
            if u['farm']==farm: text+='  '+json.dumps([u['id'],u['longitude'],u['latitude']],separators=(',',':'))+',\n'
        text+=' ],\n'
    (repo/'src/render/regional-wind.generated.ts').write_text(text+'} as const;\n')
if __name__=='__main__':
    cli=argparse.ArgumentParser(description=__doc__); cli.add_argument('workbook',type=Path);cli.add_argument('--repo',type=Path,default=Path('.'))
    args=cli.parse_args();run(args.workbook,args.repo)
