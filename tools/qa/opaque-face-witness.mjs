// Validate render-pixel scope against exact stock-geometry diagnostic tints.
// The caller must capture the same frozen camera, geometry, depth and MSAA
// state for every image. Decoded, unpremultiplied RGBA bytes only.
export function auditOpaqueFaceWitness({width, height, stock, candidate, restored, roles, positiveDelta = 6}) {
  if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0 ||
      !Number.isSafeInteger(width * height * 4) || !Number.isInteger(positiveDelta) ||
      positiveDelta < 0 || positiveDelta > 254)
    throw new RangeError('Invalid RGBA dimensions or RGB threshold');
  const size = width * height * 4;
  const rgba = (value) => {
    if (!(value instanceof Uint8Array) || value.length !== size)
      throw new TypeError('Expected one complete RGBA8 frame');
    return value;
  };
  [stock, candidate, restored].forEach(rgba);
  if (!Array.isArray(roles) || roles.length === 0) throw new TypeError('No face witnesses');
  const used = new Set();
  const counts = roles.map(({id, white, black, mayChange, projectedHull}) => {
    if (typeof id !== 'string' || !id.trim() || used.has(id) || typeof mayChange !== 'boolean')
      throw new TypeError('Missing or duplicate face id or explicit change policy');
    used.add(id);
    if (projectedHull !== undefined &&
        (!(projectedHull instanceof Uint8Array) || projectedHull.length !== width * height))
      throw new TypeError('Expected one pre-registered projected hull byte per pixel');
    return {id, white: rgba(white), black: rgba(black), mayChange, projectedHull,
      visible: 0, changed: 0, exclusiveChanged: 0, alpha: 0, outsideHull: 0};
  });
  const diff = (a, b, p) => Math.max(Math.abs(a[p] - b[p]),
    Math.abs(a[p + 1] - b[p + 1]), Math.abs(a[p + 2] - b[p + 2]));
  const report = {changed: 0, strong: 0, outside: 0, protectedOnly: 0, sharedChanged: 0, alpha: 0, rollback: 0};
  for (let p = 0; p < size; p += 4) {
    const delta = diff(stock, candidate, p);
    const stockAlpha = stock[p + 3];
    let allowed = false, protectedFace = false, hitCount = 0, only;
    for (const c of counts) {
      c.alpha += Number(c.white[p + 3] !== stockAlpha || c.black[p + 3] !== stockAlpha);
      if (diff(c.white, c.black, p) > 0) {
        c.visible++;
        if (c.projectedHull !== undefined && !c.projectedHull[p / 4]) c.outsideHull++;
        hitCount++;
        only = c;
        c.changed += Number(delta > 0);
        if (c.mayChange) allowed = true;
        else protectedFace = true;
      }
    }
    report.alpha += Number(candidate[p + 3] !== stockAlpha);
    report.rollback += Number(diff(stock, restored, p) > 0 || restored[p + 3] !== stockAlpha);
    if (delta > 0) {
      report.changed++;
      report.strong += Number(delta > positiveDelta);
      report.outside += Number(!allowed);
      // Adjacent faces can share an MSAA pixel. A protected face alone is
      // forbidden; shared coverage is not evidence of per-sample ownership.
      report.protectedOnly += Number(protectedFace && !allowed);
      report.sharedChanged += Number(hitCount > 1);
      if (hitCount === 1) only.exclusiveChanged++;
    }
  }
  return {...report, roles: counts.map(({id, visible, changed, exclusiveChanged, alpha, mayChange, projectedHull, outsideHull}) =>
    ({id, visible, changed, exclusiveChanged, alpha, mayChange, outsideHull: projectedHull === undefined ? null : outsideHull}))};
}
