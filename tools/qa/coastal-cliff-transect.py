#!/usr/bin/env python3
"""Plot the two fixed native-cell transects from verified browser geometry reports."""
import argparse
import json
from pathlib import Path


def draw(before,after):
    site=lambda report:next(s for s in report['sites'] if s['id']=='east-point')
    first,last=site(before)['visibleTransects'],site(after)['visibleTransects']
    fields=[('NRCan DTM','sourceM','#dbe8f0','5 4',3),
            ('Prior game mesh','renderedM','#e4a764','',2),
            ('Refined game mesh','renderedM','#62dfba','',3)]
    fragments=[]
    for row,x0 in [('241',72),('245',545)]:
        a,b=first[row]['points'],last[row]['points']
        if [(p['col'],p['sourceM']) for p in a]!=[(p['col'],p['sourceM']) for p in b]:
            raise ValueError('Transect observations do not match')
        rect=f'M{x0} 124H{x0+393}V341H{x0}Z'
        fragments.append(f'<path d="{rect}" fill="#101f2c" stroke="#344656"/>')
        xx=lambda c:x0+(c-174)/16*393
        yy=lambda h:341-h*14
        fragments.append(f'<text x="{x0}" y="104">Native raster row {row}</text>')
        for d in [0,5,10,15]:
            y=yy(d)
            fragments.append(f'<path d="M{x0} {y}H{x0+393}" stroke="#2b4051"/>'
                             f'<text x="{x0-13}" y="{y+5}" text-anchor="end" class="muted">{d}</text>')
        for c in [174,178,182,186,190]:
            x=xx(c)
            fragments.append(f'<text x="{x:.2f}" y="366" text-anchor="middle" class="muted">{c}</text>')
        for (_,field,colour,dash,stroke),vals in zip(fields,(b,a,b),strict=True):
            line=' '.join(f'{xx(p["col"]):.2f},{yy(p[field]):.2f}' for p in vals)
            fragments.append(f'<polyline points="{line}" stroke="{colour}" stroke-width="{stroke}" stroke-dasharray="{dash}" fill="none"/>')
        gx,gy=xx(181),yy(11.48)
        if row=='241':
            fragments.append(f'<circle cx="{gx:.2f}" cy="{gy:.2f}" fill="#dbe8f0" r="4.5"/>'
                             f'<path d="M{gx:.2f} {gy-5:.2f}v-17h28" stroke="#dbe8f0" stroke-width="1.5" fill="none"/>'
                             f'<text x="{gx+36:.2f}" y="{gy-18:.2f}" class="muted">Prior worst cell</text>')
    for x,(name,_,colour,dash,stroke) in zip([72,301,546],fields,strict=True):
        fragments.append(f'<path d="M{x} 56h28" stroke="{colour}" stroke-dasharray="{dash}" stroke-width="{stroke}"/>'
                         f'<text x="{x+40}" y="61">{name}</text>')
    return """<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="429" viewBox="0 0 1000 429" role="img">
<title>East Point cliff terrain profiles: native data, previous rendering, and sparse-refined rendering</title>
<desc>Two native raster rows show that the refined mesh reproduces the step down the cliff more closely than the previous model. Values are metres above the CGVD2013 datum.</desc>
<style>text{fill:#dbe8f0;font:16px system-ui,sans-serif}.muted{fill:#9eb4c7;font-size:13px}.title{font-size:22px;font-weight:650}</style>
<rect width="1000" height="429" rx="11" fill="#0d1924"/>
<text x="72" y="33" class="title">East Point cliff · 1 m survey cross-sections</text>
<text class="muted" x="27" y="235" text-anchor="middle" transform="rotate(-90 27 235)">Height above vertical datum (m)</text>
<text x="500" y="395" text-anchor="middle" class="muted">Native column (1 m eastward per step)</text>
<text x="500" y="416" text-anchor="middle" class="muted">Game-mesh heights from in-browser Three.js triangles; all samples share CGVD2013.</text>
"""+'\n'.join(fragments)+'\n</svg>\n'


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--before',type=Path,required=True);p.add_argument('--after',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
    a=p.parse_args();a.out.write_text(draw(json.loads(a.before.read_text()),json.loads(a.after.read_text())))
