#!/usr/bin/env python
"""Fixed real Three.js QA views of Bowley Pond, not reference material."""
import argparse, importlib.util, json, math, base64
from pathlib import Path
D=Path(__file__).resolve().parent
R=D.parents[1]
q=importlib.util.spec_from_file_location('fixed',D/'fixed-scenery.py')
f=importlib.util.module_from_spec(q);q.loader.exec_module(f)
def pose(eye,look,h,y):
    x=(eye[0]-look[0])*76766.24;z=(eye[1]-look[1])*-111161.2
    return dict(lon=look[0],lat=look[1],east=x,south=z,nearDist=math.hypot(x,z),nearAgl=y,h=h*2,fixedEyeY=y,fixedBaseH=0.)
f.VIEWS.update({
 'greenwich-pond':pose((-62.7093,46.44566),(-62.71000,46.44801),.65,19),
 'greenwich-anchor':pose((-62.70776,46.44596),(-62.70747,46.44631),.75,5.1),
 'greenwich-rise':pose((-62.711478,46.448828),(-62.71095,46.44746),.75,28.5),
 'greenwich-waterline':pose((-62.708921,46.4484427),(-62.708134,46.448574),1.132,3.55),
 'greenwich-mainbody':pose((-62.710091,46.447599),(-62.708161,46.448628),1.132,47.6),
 'greenwich-wetface':pose((-62.707327,46.448749),(-62.709011,46.448351),1.132,12.25),
 'greenwich-air':pose((-62.70843,46.44480),(-62.71015,46.44823),1.2,130),
})
A=f.stage
def stage(repo,root,deps,void):
    A(repo,root,deps,void)
    p=root/'src/main.ts';s=p.read_text()
    a="const diagnostic="
    s=f.once(s,a,'''(window as any).textureIds=()=>((world as any).tiles as any[]).filter(t=>t.status==='ready').map(t=>t.id).sort();
    (window as any).bowleyRasterQA=()=>{
      const gl=renderer.getContext();return {samples:gl.getParameter(gl.SAMPLES),width:gl.drawingBufferWidth,height:gl.drawingBufferHeight};
    };
    let captureQA:{probe:boolean,done:(images:string[])=>void}|null=null;
    let motionX=0,motionZ=0;
    (window as any).grabReviewCanvas=(dx=0,dz=0,probe=false)=>new Promise<string[]>(done=>{
      motionX=dx;motionZ=dz;captureQA={probe,done};
    });
    (window as any).geographyQA=(pts:readonly number[][])=>pts.map(q=>{const {x,z}=project(q[0],q[1]);return {x,z,cover:world.cover.distance(world.terrain,x,z),visual:world.visualGroundHeight(x,z),ground:world.groundHeight(x,z),surface:world.surface(x,z),flight:sceneSurface(x,z),backdropLand:mainland?.isLand(x,z)??null,bowley:(world as any).bowleyContains?.(x,z)??false};});
    '''+a)
    s=f.once(s,'ex=center.x+qa.dist*qa.east/norm,ez=center.z+qa.dist*qa.south/norm',
             'ex=center.x+qa.dist*qa.east/norm+motionX,ez=center.z+qa.dist*qa.south/norm+motionZ')
    a="  renderer.render(scene,camera);"
    s=f.once(s,a,a+'''
    if(captureQA){
      const {probe,done}=captureQA;captureQA=null;
      const images=[renderer.domElement.toDataURL('image/png')];
      if(probe){
        const sky=(world as any).sky.material.uniforms.skyDiagnostic;
        sky.value=1.;renderer.render(scene,camera);sky.value=0.;
        images.push(renderer.domElement.toDataURL('image/png'));
      }
      done(images);
    }
    ''')
    p.write_text(s)
f.stage=stage
A0=f.settle
def settle(page,errors):
    if a.lock_stream:
        page.wait_for_function('window.textureIds?.().length===12')
    d=A0(page,errors)
    d['orthoIds']=page.evaluate('window.textureIds()')
    d['raster']=page.evaluate('window.bowleyRasterQA()')
    if a.lock_stream:
        assert d['orthoIds']==['20-12','20-13','21-12','21-13','21-14','22-12','22-13','22-14','23-11','23-12','23-13','24-12'],d
    d['bowleyRequests']=page.evaluate("performance.getEntriesByType('resource').filter(r=>r.name.endsWith('bowley-2020-water.r8.gz')).length")
    if 'bowleySurveyPreview' in a.extra:
        assert d.get('bowleyPond') == ('bowley-pond-survey-2020' if not a.corrupt else None),d
        assert d['bowleyRequests']==1,d
    else:
        assert not d['bowleyRequests'],d
    d['controls']=page.evaluate('points=>window.geographyQA(points)',[[-62.7073147,46.4453551],[-62.7077837,46.4466245],[-62.7103453,46.4482999],[-62.7139013,46.4486817],[-62.710,46.4472],[-62.707,46.4488]])
    points=[[-62.708898169803,46.449062659262],[-62.708116539095,46.448702821100],
            [-62.707400044280,46.448401456640],[-62.70914,46.44553],[-62.70914,46.45172]]
    d['pondFlightControls']=page.evaluate('p=>window.geographyQA(p)',points)
    if d.get('bowleyPond'):
        for q in d['pondFlightControls'][:2]:
            assert q['bowley'] and q['surface']==q['flight']=={'height':1.132,'land':False,'runway':False},q
    return d
f.settle=settle
A1=f.capture
class Browser:
    def __init__(self,raw,extra):self.raw=raw;self.extra=extra
    def new_context(self,**kwargs):
        kwargs['device_scale_factor']=a.device_scale
        c=self.raw.new_context(**kwargs);mk=c.new_page
        def new_page():
            p=mk();go=p.goto
            if a.corrupt:
                p.route('**/bowley-2020-water.r8.gz',lambda r:r.fulfill(status=200,body=b'invalid local 49K test'))
            p.goto=lambda u,**kwargs:go(u.replace('/?diagnostics&qa=', '/?diagnostics&'+self.extra+'qa='),**kwargs)
            def shot(path,timeout):
                target=Path(path)
                image=lambda value:base64.b64decode(value.split(',',1)[1])
                if not a.aperture_motion:
                    b=image(p.evaluate('()=>window.grabReviewCanvas()')[0])
                    target.write_bytes(b);return b
                rows=[]
                for index,(x,z) in enumerate([(-4.,-2.),(-2.,-1.),(0.,0.),(2.,1.),(4.,2.)]):
                    art,sky=map(image,p.evaluate('(q)=>window.grabReviewCanvas(q[0],q[1],true)',[x,z]))
                    target.with_name(f'{target.stem}-{index}-art.png').write_bytes(art)
                    target.with_name(f'{target.stem}-{index}-void.png').write_bytes(sky)
                    rows.append(dict(offsetXZ=[x,z],pose=p.evaluate('window.reviewCamera'),
                        orthoIds=p.evaluate('window.textureIds()'),raster=p.evaluate('window.bowleyRasterQA()')))
                    if index==2:target.write_bytes(art)
                target.with_name(f'{target.stem}-motion.json').write_text(json.dumps(rows,indent=2)+'\n')
                return art
            p.screenshot=shot
            return p
        c.new_page=new_page
        return c
def capture(args,browser,url):return A1(args,Browser(browser,(''.join(a+'&' for a in args.extra.split(',') if a))),url)
f.capture=capture
p=argparse.ArgumentParser()
p.add_argument('--checkout',type=Path,default=R)
p.add_argument('--deps',type=Path)
p.add_argument('--chromium',type=Path,required=True)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--views',default='greenwich-waterline-close,greenwich-mainbody-close,greenwich-wetface-close')
p.add_argument('--extra',default='')
p.add_argument('--lock',dest='pose_baseline',type=Path)
p.add_argument('--void',dest='void_probe',action='store_true')
p.add_argument('--corrupt',action='store_true')
p.add_argument('--lock-stream',action='store_true')
p.add_argument('--size',default='900x564',help='CSS viewport width×height as WIDTHxHEIGHT')
p.add_argument('--device-scale',type=float,default=1.,help='Chromium viewport pixel scaling')
p.add_argument('--aperture-motion',action='store_true',help='Pair normal vs diagnostic sky across ±4m fixed-camera translations')
a=p.parse_args()
if a.aperture_motion and a.void_probe:p.error('Use sky-only mode or paired aperture mode, not both.')
a.chromium=str(a.chromium)
f.run(a)
