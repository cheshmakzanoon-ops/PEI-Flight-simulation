#!/usr/bin/env python3
"""Fit continuous surveyed roof faces to the unchanged AEB building outline.

Uses only the stock Canadian AEB record and the 1 m HRDEM ground/surface sample.
Parks Canada's registry is architectural context, not digitized geometry.
Needs numpy, GDAL and its Python bindings. The official 76×77 raster window
can be filled over HTTPS, or supplied from a previously verified local .npz.
"""
from pathlib import Path
from hashlib import sha256
import argparse
import gzip
import json
import math
import runpy

import numpy as np
from osgeo import ogr, osr

ROOT = Path(__file__).resolve().parents[2]
REGION = 'q130331'
ORDINAL = 170
ATLAS_SHA = '538bcf3cb372be782e6f29d1c9226ca9d05cea9f3a0ac173b9844cc5174fe557'
CHUNK_SHA = 'a7ee1263f0c19b2b570f24cf1874c0e882b895d778ad63ab3939d8adcaca7d55'
WINDOW_SHA = 'da4e655310c38ea28ecda88d77b1986874daa2fae79f1add0b2526a08e579742'
DIMS = (437235, 154022, 76, 77)
ORIGIN = np.array([2437235., 345978.])
RAD = math.pi / 180
LATITUDE_FACTOR = 1.0 - 6.69437999014e-3 * math.sin(46.5 * RAD) ** 2
WORLD_ORIGIN = np.array([-63.2, 46.5])
SCALE = np.array([6378137 * RAD * math.cos(46.5 * RAD) / math.sqrt(LATITUDE_FACTOR),
                  -6378137 * (1 - 6.69437999014e-3) * RAD / LATITUDE_FACTOR ** 1.5])
ASSEMBLY_SOURCE = 'https://open.canada.ca/data/en/dataset/7069387e-9986-4297-9f55-0288e9676947'
REFERENCE_SOURCE = 'https://www.historicplaces.ca/en/rep-reg/place-lieu.aspx?id=5983'
TOWN_REFERENCE = 'https://sourispei.com/wp-content/uploads/2026/03/Mousetales-Digital-APRIL-2026-.pdf'


def spatial_refs():
    out = []
    for epsg in (4326, 3979):
        s = osr.SpatialReference()
        s.ImportFromEPSG(epsg)
        s.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
        out.append(s)
    return out


def atlas(root):
    index = json.loads((root / 'index.json').read_text())
    data = (root / 'tiles.pack').read_bytes()
    if sha256(data).hexdigest() != index['sha256'] or index['sha256'] != ATLAS_SHA:
        raise ValueError('Building atlas revision changed')
    tile = next(t for t in index['tiles'] if t['id'] == REGION)
    packet = data[tile['offset']:tile['offset'] + tile['bytes']]
    if sha256(packet).hexdigest() != CHUNK_SHA:
        raise ValueError('Building owner packet changed')
    building = json.loads(gzip.decompress(packet))['features'][ORDINAL]
    if building.get('holes') or len(building['footprint']) != 16 or building['height'] != 11.6:
        raise ValueError('Ordered AEB source shape changed')
    return building, tile


def raster(local):
    if local:
        ref = np.load(local, allow_pickle=False)
        t, s, o = ref['dtm'], ref['dsm'], ref['origin']
    else:
        reader = runpy.run_path(str(ROOT / 'tools/qa/roof-fit-pilot.py'))
        dsm, dtm, g, _ = reader['open_models']()
        t, s = dtm.ReadAsArray(*DIMS), dsm.ReadAsArray(*DIMS)
        o = [g[0] + DIMS[0], g[3] - DIMS[1]]
    source = sha256(t.astype('<f4').tobytes() + s.astype('<f4').tobytes()).hexdigest()
    if list(o) != list(ORIGIN) or t.shape != s.shape or t.shape != (DIMS[3], DIMS[2]) or source != WINDOW_SHA:
        raise ValueError('Native 1 m survey inputs differ from the pinned witness')
    return t, s


def plane(design, target, selection):
    fit = design[selection]
    vals = target[selection]
    assert len(vals) >= 16, len(vals)
    w = np.ones_like(vals)
    for _ in range(7):
        c = np.linalg.lstsq(fit*w[:,None], vals*w, rcond=None)[0]
        w = np.sqrt(np.minimum(1., .17/np.maximum(.001, abs(fit@c-vals))))
    return c


def identically_partition(coef, y_fac):
    """Y differences of adjacent planes increase towards the east."""
    west, left, right, lean = coef
    cuts = np.array([left-west, left-right, lean-right])
    assert np.all(cuts[:,1] > .39)
    u_at_depth = (-cuts[:,0,None]-cuts[:,2,None]*np.array([0.,23.25]))/cuts[:,1,None]
    assert np.all((u_at_depth[:,0]>[8.7,12.8,16.9]) & (u_at_depth[:,0]<[11.5,14.55,18.9])), (u_at_depth, coef)
    assert np.min(np.diff(u_at_depth,axis=0))>2.0
    group = ((y_fac@cuts.T) >= 0).sum(1)
    return cuts,u_at_depth,group


def q(values):
    return np.quantile(values, [.5,.9,.95,1.]).round(5).tolist()


def solve(ref):
    building,tile = atlas(ROOT/'public/world/buildings')
    lon_lat = building['footprint']
    sr = spatial_refs()
    to_native, to_lonlat = (osr.CoordinateTransformation(*r) for r in (sr, sr[::-1]))
    ring = np.asarray(to_native.TransformPoints(lon_lat))[:,:2]-ORIGIN
    p0 = ring[15]
    front = ring[14]-p0
    front /= np.linalg.norm(front)
    inward = np.array([-front[1],front[0]])
    basis = np.array([front,inward])
    t,s = raster(ref)
    yy,xx=np.indices(s.shape)
    cart=np.stack([xx+.5,-yy-.5],axis=-1) - p0
    design_all=np.concatenate([np.ones((*t.shape,1)),cart@basis.T],axis=-1)
    u = design_all[...,1];v=design_all[...,2]
    # Exact polygon membership and metric distance to original AEB edges.
    odd=np.zeros(s.shape,bool);dist=np.full(t.shape,np.inf)
    local=np.stack([xx+.5,-yy-.5],axis=-1)
    for a,b in zip(ring,np.roll(ring,-1,axis=0)):
        x,y=b-a
        query=local-a
        if abs(y)>1e-10:odd^=(((a[1]>local[...,1])!=(b[1]>local[...,1])) & (query[...,0]<x*query[...,1]/y))
        part=np.clip((query[...,0]*x+query[...,1]*y)/(x*x+y*y),0,1)
        dist=np.minimum(dist,np.linalg.norm(query-part[...,None]*(b-a),axis=-1))
    mask=odd&(dist>=1.05)&(s-t>4)&np.isfinite(s)&np.isfinite(t)
    held=mask&(((xx//3)*3+(yy//3)*7+1)%5==0)
    fit=mask&~held
    # Initial physically distinct planes are trained away from seam mixing.
    # The available profile dictated boundaries; reserved blocks never feed the coefficients.
    regions=[(1.3,9.6),(10.8,12.85),(14.7,17.55),(18.9,26.3)]
    selections=[fit&(u>a)&(u<b) for a,b in regions]
    coef=np.stack([plane(design_all,s,m) for m in selections])
    aff=np.asarray(to_lonlat.TransformPoints((ORIGIN+p0+np.vstack((np.zeros(2),basis))).tolist()))[:,:2]
    pts=(aff-WORLD_ORIGIN)*SCALE
    world_basis=np.linalg.inv(pts[1:]-pts[0])
    starts,cross,regions_all=identically_partition(coef,design_all.reshape(-1,3))
    yhat=(design_all.reshape(-1,3)*coef[regions_all]).sum(1).reshape(t.shape)
    exact_geodetic=np.asarray(to_lonlat.TransformPoints((local+ORIGIN).reshape(-1,2)))[:,:2].reshape((*t.shape,2))
    source_world=(exact_geodetic-WORLD_ORIGIN)*SCALE
    matched=(source_world-pts[0])@world_basis
    alignment=np.linalg.norm(matched-design_all[...,1:],axis=-1)
    assert alignment[mask].max()<.001, alignment[mask].max()
    # Independent, unchanged generic four-story-looking box from the
    # integer-metre terrain atlas plus .05m and the stored 11.6m height.
    terrain_path=ROOT/'public/world'
    manifest=json.loads((terrain_path/'terrain.json').read_text())
    terrain=np.frombuffer(gzip.decompress((terrain_path/'height.bin.gz').read_bytes()),dtype='<i2').reshape(manifest['height'],manifest['width'])
    W,S,E,N=manifest['bounds'];lon,lat=np.asarray(lon_lat).mean(0)
    fx=(lon-W)/(E-W)*manifest['width']-.5;fy=(N-lat)/(N-S)*manifest['height']-.5
    ji=np.floor([fy,fx]).astype(int);dy,dx=np.array([fy,fx])-ji
    c=terrain[ji[0]:ji[0]+2,ji[1]:ji[1]+2];assert np.all(c!=-32768)
    old=np.sum(c*np.outer([1-dy,dy],[1-dx,dx]))+.05+building['height']
    oldfit=q(abs(s[held]-old));newfit=q(abs(s[held]-yhat[held]))
    assert held.sum()>=50 and newfit[1]<.52 and newfit[1]<.40*oldfit[1],(held.sum(),newfit,oldfit)
    rounded=lambda v,n:np.round(v,n).tolist()
    plan=dict(atlasSha256=ATLAS_SHA,tile=REGION,ordinal=ORDINAL,source=lon_lat,
      originXZ=rounded(pts[0],8),worldToFace=rounded(world_basis,12),planes=rounded(coef,9),
      cut=rounded(starts,9))
    measure=dict(site='Matthew and McLean Heritage Building, 95 Main Street, Souris',
      datum='EPSG:3979 horizontal, CGVD2013 orthometric height',
      dataOGL='https://open.canada.ca/en/open-government-licence-canada',
      sourceStac='https://datacube.services.geo.ca/stac/api/collections/hrdem-mosaic-1m/items/10_3-mosaic-1m',
      sourceMetadata=ASSEMBLY_SOURCE,
      COGStem='https://canelevation-dem.s3.ca-central-1.amazonaws.com/hrdem-mosaic-1m/10_3-mosaic-1m',
      authorship='Native CanElevation surface and ground data, original footprint from the existing AEB atlas; no photographs or OSM footprints in the renderer.',
      heritageRegistryContext=REFERENCE_SOURCE, municipalityVisualContext=TOWN_REFERENCE,
      municipalityVisualContextPublication='Mousetales, April 2026, page 17; observed form and subdued color only, photo date and exact dimensions not asserted.',
      training='Roof regions assigned from documented geometry and visible profiles; spatial held-out cells do not fit coefficients but are not an independent acquisition.',
      atlas={'id':REGION,'ordinal':ORDINAL,'atlasSha256':ATLAS_SHA,'gzipChunkSha256':CHUNK_SHA,'tileRangeBytes':[tile['offset'],tile['bytes']]},
      pixelWindow=list(DIMS), rasterRawSha256=WINDOW_SHA, frontFootprintEdge=[15,14],
      actualSupportedSourceCellsInOutline=int(odd.sum()), stableInteriorTrainCandidates=int(fit.sum()),
      trainingPerPlane=[int(x.sum())for x in selections], heldOutCells=int(held.sum()),
      quantiles=[.50,.90,.95,1.], rawHeldOutAbsErrorMetres={'old':oldfit,'new':newfit},
      rawAllCoreAbsErrorMetres={'old':q(abs(s[mask]-old)),'new':q(abs(s[mask]-yhat[mask]))},
      oldFlatHeightMetres=float(old), nativeBasisRegistrationMaxErrorMetres=float(alignment[mask].max()),
      uCutsAtV0And23p25Metres=rounded(cross,6), nativeOutlineXZ=rounded(ring+ORIGIN,7))
    points=np.c_[source_world[held],s[held]]
    return plan, measure, rounded(points,7)


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--window',type=Path,help='Optional verified local 76×77 crop on the native EPSG:3979 grid')
    p.add_argument('--verify',action='store_true')
    a=p.parse_args()
    plan,notes,points=solve(a.window)
    expected={
       ROOT/'src/render/souris-mclean.generated.ts':('// Generated with tools/geodata/bake-souris-mclean.py; do not edit.\n'
          +'export const SOURIS_MCLEAN='+json.dumps(plan,separators=(',',':'))+' as const;\n').encode(),
       ROOT/'data/souris-main/mclean-source.json':(json.dumps(notes,indent=2)+'\n').encode(),
       ROOT/'data/souris-main/mclean-native-holdout.json':(json.dumps(points,separators=(',',':'))+'\n').encode(),
    }
    for path,data in expected.items():
        if a.verify:
            if path.read_bytes()!=data:raise ValueError(f'Reproducibility check failed: {path.name}')
        else:path.write_bytes(data)
    print(json.dumps({k:notes[k] for k in ('trainingPerPlane','heldOutCells','rawHeldOutAbsErrorMetres',
      'rawAllCoreAbsErrorMetres','uCutsAtV0And23p25Metres','nativeBasisRegistrationMaxErrorMetres')},indent=2))


if __name__=='__main__':main()
