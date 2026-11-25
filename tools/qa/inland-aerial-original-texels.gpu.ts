// Read-only QA callback. Inserted into the disposable normal-game loop by verify-inland-aerial-original-texels.py.
(window as any).stockAndStripSamples = async () => {
    const pair=(ortho as any)?.pairs?.find(p=>p.plan.first===qa.owners[0]&&p.plan.second===qa.owners[1]);
    if(!pair?.live||pair.gain.value!==1||pair.plan.axis!=='x')throw new Error('No real fully resident east/west GPU strip');
    const left=pair.live.n,right=pair.live.s,strip=pair.live.strip;
    const own=(world as any).tiles.filter(t=>qa.owners.includes(t.id));
    if(own.find(t=>t.id===qa.owners[0])?.detail!==left||own.find(t=>t.id===qa.owners[1])?.detail!==right||own.some(t=>t.local.uniforms.orthoSharedRows.value!==strip))throw new Error('Inspection requires actual current drawn owner inputs');
    const gl=renderer.getContext();
    const target=new THREE.WebGLRenderTarget(13,640,{depthBuffer:false,stencilBuffer:false,type:THREE.UnsignedByteType,format:THREE.RGBAFormat});target.texture.colorSpace=THREE.NoColorSpace;
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
    const mat=new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,depthTest:false,depthWrite:false,blending:THREE.NoBlending,toneMapped:false,
       uniforms:{firstSource:{value:left},secondSource:{value:right},liveStrip:{value:strip},which:{value:0}},
       vertexShader:`precision highp float;in vec3 position;void main(){gl_Position=vec4(position.xy,0.,1.);}`,
       fragmentShader:`precision highp float;precision highp int;uniform highp sampler2D firstSource,secondSource,liveStrip;uniform int which;out vec4 pix;
       vec4 atSource(int i,float y){return i<2?textureLod(firstSource,vec2((638.5+float(i))/640.,y),0.):textureLod(secondSource,vec2((float(i)-1.5)/640.,y),0.);}
       void main(){int col=int(gl_FragCoord.x),row=int(gl_FragCoord.y);float crossTexel=-1.5+.25*float(col),v=(639.5-float(row))/640.,u=.5+crossTexel*.25;
        float k=.25*float(col);int i=int(floor(k)),j=min(i+1,3);pix=which==0?mix(atSource(i,v),atSource(j,v),fract(k)):textureLod(liveStrip,vec2(u,v),0.);
       }`});
    const sc=new THREE.Scene(),camera2=new THREE.Camera();const quad=new THREE.Mesh(geo,mat);quad.frustumCulled=false;sc.add(quad);const original=renderer.getRenderTarget();
    const img=[] as Uint8Array[];
    try {for(let mode=0;mode<2;mode++){mat.uniforms.which.value=mode;renderer.setRenderTarget(target);renderer.render(sc,camera2);const bytes=new Uint8Array(13*640*4);renderer.readRenderTargetPixels(target,0,0,13,640,bytes);img.push(bytes);}}
    finally{renderer.setRenderTarget(original);geo.dispose();mat.dispose();target.dispose();}
    const [ref,actual]=img;let centres=0,centreMax=0,centreDiff=0,intermediateMax=0,intermediateDiffGt1=0,maxNativeAcross=0;const centerBytes=new Uint8Array(640*4*4),midRows=[];
    for(let row=0;row<640;row++){for(let c=0;c<=12;c++){const i=(row*13+c)*4;const diff=Math.max(...[0,1,2,3].map(b=>Math.abs(ref[i+b]-actual[i+b])));if(c%4===0){centres++;if(diff>0)centreDiff++;centreMax=Math.max(centreMax,diff);centerBytes.set(ref.slice(i,i+4),(row*4+c/4)*4);}
      else{intermediateMax=Math.max(intermediateMax,diff);if(diff>1)intermediateDiffGt1++;}}
      if(Math.abs(row-qa.row)<=8){const colRGB=(c,src)=>Array.from(src.slice((row*13+c)*4,(row*13+c)*4+3));const A=colRGB(4,ref),B=colRGB(8,ref),mid=colRGB(6,actual);maxNativeAcross=Math.max(maxNativeAcross,Math.hypot(...A.map((a,i)=>a-B[i])));midRows.push({row,left:A,center:mid,right:B});}}
    const sha=async(b:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');
    return {edge:qa.owners,actualSourceIds:[left.uuid,right.uuid],actualStripId:strip.uuid,actualStripDimensions:[strip.image.width,strip.image.height],selectedOwnerMaterialUsesSameStrip:true,
      fullOriginalTexelCenters:centres,centresDifferent:centreDiff,maximumCentreAbsoluteChannelError:centreMax,intermediatePositions:640*9,maximumQuarterTexelRGBAError:intermediateMax,quarterTexelErrorsOverOne:intermediateDiffGt1,
      maximumRealGeographicSourceStepWithinTargetRGB:maxNativeAcross,chosenRows:midRows,originalCentresRawHash:await sha(centerBytes),fullReferenceHash:await sha(ref),fullStripSampledHash:await sha(actual),glError:gl.getError(),lost:gl.isContextLost()};
  };
