import { BufferGeometry, Float32BufferAttribute } from 'three';

type Vertex = readonly [number, number, number];

/**
 * Original approximation from the published octagon-to-rectangle design.
 * Local +X follows the deck tangent; +Z is across it. Y is normalized to the
 * inherited collar/soffit attachment. No below-water surfaces or added draws.
 */
export function mainBridgeShaftGeometry(): BufferGeometry {
  // 8 m across flats; the bearing inside the octagonal ice-shield junction
  // is slightly inset so no faceted corners overhang its stock 12-sided rim.
  const lowerChamfer=4*(2-Math.SQRT2);
  const seat=.96;
  const ring=(x:number,y:number,z:number,c:number): Vertex[]=>[
    [x-c,y,z], [-x+c,y,z], [-x,y,z-c], [-x,y,-z+c],
    [-x+c,y,-z], [x-c,y,-z], [x,y,-z+c], [x,y,z-c],
  ];
  const foot=ring(4*seat,-.5,4*seat,lowerChamfer*seat);
  const lower=ring(4,-.482,4,lowerChamfer);
  // Nominal 10 m along and 5 m across the girder. The tiny corner breaks
  // retain a valid loft. Bury the lid in the existing rising soffit, rather
  // than changing the deck or moving the pier's stock positioning matrix.
  const head=ring(5,.545,2.5,.045);
  const positions:number[]=[];
  const tri=(a:Vertex,b:Vertex,c:Vertex)=>positions.push(...a,...b,...c);
  const wall=(a:Vertex[],b:Vertex[])=>{
    for(let i=0;i<a.length;i++){
      const k=(i+1)%a.length;
      tri(a[i],b[i],b[k]);tri(a[i],b[k],a[k]);
    }
  };
  wall(foot,lower);wall(lower,head);
  for(let i=1;i<foot.length-1;i++){
    tri(foot[0],foot[i],foot[i+1]);tri(head[0],head[i+1],head[i]);
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}
