#!/usr/bin/env python3
"""Bake original tileable wind-wave slope noise from a directional wave spectrum.
Deterministic synthetic sea state. Output RG channels encode signed x/z slope
with range +/-0.5. Requires NumPy and Pillow; no sampled/vendor water textures.
"""
from pathlib import Path
import numpy as np
from PIL import Image
size=512;metres=86.0
rng=np.random.default_rng(18)
k=np.fft.fftfreq(size,d=metres/size)*2*np.pi;kx,kz=np.meshgrid(k,k);k2=kx*kx+kz*kz
safe=np.where(k2>0,k2,1.0);along=(kx*.879+kz*.477)/np.sqrt(safe)
# Phillips/Tessendorf family: 4.4 m/s fetch-limited wind, with modest directional spread.
L=4.4**2/9.80665
P=np.exp(-1/(safe*L**2))*(.12+.88*along**2)*np.exp(-safe*.105**2)/safe**2;P[0,0]=0
S=np.fft.fft2(rng.standard_normal((size,size)))*np.sqrt(P)
x=np.fft.ifft2(1j*kx*S).real;z=np.fft.ifft2(1j*kz*S).real
scale=.095/np.sqrt(np.mean(x*x+z*z));n=np.stack((x*scale,z*scale,np.ones_like(x)*.49),axis=-1)
img=Image.fromarray(np.rint((np.clip(n,-.5,.5)+.5)*255).astype('uint8'),'RGB');path=Path('public/art/wind-slopes.webp');path.parent.mkdir(parents=True,exist_ok=True);img.save(path,lossless=True,method=6)
