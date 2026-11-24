/** St. David's United Church exterior study only. Native horizontal metres, CGVD2013 heights.
 * These fit coefficients are from original 2020 CL6/CL1 survey returns, not from photos.
 * Retain the exact registered owner in QA. Nominal authored envelope is not a runtime footprint. */
export type UV = [number,number];
export type Pt = [number,number,number];
export type Plane=[number,number,number];
export const DATUM=7.55;
export const OWNER:UV[]=[[-1.816775140746095, 3.012590945031334], [-1.7875926323065257, 6.579287096435939], [1.6479435007686756, 6.547863976209381], [1.6782186396135872, 3.1952908131053657], [5.039390576759356, 3.184518845187897], [5.027055317231863, -12.72567217067607], [-4.907753996104916, -12.734649318537492], [-4.880486266172761, 2.9407698115790755]];
export const NAVE_W:Plane=[0.6881329601109948, 0.010088435737789355, 16.20598190400458];
export const NAVE_E:Plane=[-0.7005358069161175, -0.01608469532565132, 16.29457286467186];
export const ANNEX_W:Plane=[0.7317438975646391, 0.026039680425381004, 12.048704858140445];
export const ANNEX_E:Plane=[-0.8456153510372595, -0.014596234398891841, 11.976375255640706];
export const TOWER_CAP:readonly [number,number,number,number,number]=[-0.06990601981632479, 4.7093566317300235, 19.414788944411672, 0.35225440454221035, 0.3627844408560338];
export const plane=(p:Plane,u:number,v:number)=>p[0]*u+p[1]*v+p[2];
