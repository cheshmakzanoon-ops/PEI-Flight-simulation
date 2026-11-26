// A continuous CPU certificate, not a GPU sampler or a current shoreline
// claim. Values of two bilinear fields attain their extrema at the corners
// of any rectangle cut at both texel-centre grids.
const finite = Number.isFinite;
const list = (value, n) => Array.isArray(value) && value.length === n && value.every(finite);

function validate(field, binary = false) {
  if (!field || !list(field.origin, 2) || !list(field.spacing, 2) ||
      !field.spacing.every(v => v > 0) ||
      !Number.isSafeInteger(field.width) || !Number.isSafeInteger(field.height) ||
      field.width < 1 || field.height < 1 || !Number.isSafeInteger(field.width * field.height) ||
      !ArrayBuffer.isView(field.values) || field.values.length !== field.width * field.height)
    throw new TypeError('Invalid field grid or value count');
  for (const v of field.values)
    if (!finite(v) || (binary && v !== 0 && v !== 1)) throw new TypeError('Invalid scalar or authority value');
  return field;
}

function breakpoints(min, max, axis, specs) {
  const values = new Set([min, max]);
  for (const [f, shift] of specs) {
    const o = f.origin[axis], d = f.spacing[axis], n = axis ? f.height : f.width;
    for (let i = Math.max(0, Math.floor((min-o)/d-shift)); i <= (shift===0?n:n-1) && o+(i+shift)*d < max; i++) {
      const k = o+(i+shift)*d;
      if (k > min) values.add(k);
    }
  }
  return [...values].sort((a, b) => a-b);
}

function axisIndex(f, coordinate, axis) {
  const n = axis ? f.height : f.width, t = Math.min(n-1, Math.max(0,
    (coordinate-f.origin[axis])/f.spacing[axis]-.5));
  const lo = Math.floor(t);
  return [lo, Math.min(lo+1,n-1), t-lo];
}

function value(f, x, y) {
  const [i, i1, u] = x, [j, j1, v] = y, w = f.width, a = f.values;
  return (a[j*w+i]*(1-u)+a[j*w+i1]*u)*(1-v) + (a[j1*w+i]*(1-u)+a[j1*w+i1]*u)*v;
}
function maximum(f, xs, ys, i, j) {
  return Math.max(value(f,xs[i],ys[j]), value(f,xs[i+1],ys[j]),
    value(f,xs[i],ys[j+1]), value(f,xs[i+1],ys[j+1]));
}

function permitted(f, x, z) {
  const i = Math.floor((x-f.origin[0])/f.spacing[0]), j = Math.floor((z-f.origin[1])/f.spacing[1]);
  return i >= 0 && j >= 0 && i < f.width && j < f.height && f.values[j*f.width+i] === 1;
}

/**
 * Sensitive case: proposed wet value strictly above wetThreshold and old
 * ground value at or above dryThreshold outside the independently sealed
 * authority. A rectangle with possible independent maxima is conservatively
 * unresolved, even if the two maxima do not occur at the same point.
 *
 * Coordinates are world-space metres. Origin is the before-first-texel edge;
 * bilinear fields use clamped edge texels inside the supplied audit bounds.
 * The caller must audit the entire effect bounds and apply any shader/native
 * numerical margins. Authority is piecewise constant in its own square grid.
 */
export function certifyWetScope({
  stock, candidate, authority, bounds, dryThreshold, wetThreshold,
  stockMargin = 0, candidateMargin = 0, maxRectangles = 2_000_000,
}) {
  [stock, candidate].forEach(f => validate(f)); validate(authority,true);
  if (!list(bounds,4) || bounds[0] >= bounds[2] || bounds[1] >= bounds[3] ||
      ![dryThreshold,wetThreshold,stockMargin,candidateMargin].every(finite) ||
      stockMargin < 0 || candidateMargin < 0 || !Number.isSafeInteger(maxRectangles) || maxRectangles < 1)
    throw new RangeError('Invalid scope bounds, thresholds or rectangle ceiling');
  const specs = [[stock,.5],[candidate,.5],[authority,0]];
  const x = breakpoints(bounds[0],bounds[2],0,specs), z = breakpoints(bounds[1],bounds[3],1,specs);
  const rectangles = (x.length-1)*(z.length-1);
  if (!Number.isSafeInteger(rectangles) || rectangles > maxRectangles)
    throw new RangeError('Rectangle ceiling exceeded');
  const cx = x.map(v=>axisIndex(candidate,v,0)), cz = z.map(v=>axisIndex(candidate,v,1));
  const sx = x.map(v=>axisIndex(stock,v,0)), sz = z.map(v=>axisIndex(stock,v,1));
  let possibleWet = 0, unauthorizedWet = 0, unresolved = 0, areaUpperBound = 0;
  let maxOldOnUnauthorized = -Infinity;
  for (let j=0;j<z.length-1;j++) for (let i=0;i<x.length-1;i++) {
    if (maximum(candidate,cx,cz,i,j)+candidateMargin <= wetThreshold) continue;
    possibleWet++;
    if (permitted(authority,(x[i]+x[i+1])*.5,(z[j]+z[j+1])*.5)) continue;
    unauthorizedWet++;
    const old = maximum(stock,sx,sz,i,j);
    maxOldOnUnauthorized = Math.max(maxOldOnUnauthorized,old);
    if (old+stockMargin >= dryThreshold) {
      unresolved++;
      areaUpperBound += (x[i+1]-x[i])*(z[j+1]-z[j]);
    }
  }
  return {rectangles,possibleWet,unauthorizedWet,unresolved,areaUpperBound,
    maxOldOnUnauthorized:finite(maxOldOnUnauthorized)?maxOldOnUnauthorized:null};
}
