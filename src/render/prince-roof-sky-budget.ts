/** The owner-local field occupies 110 aligned uint4 slots, not 2,198 scalar slots.
 * The limit is measured by Three at startup via MAX_FRAGMENT_UNIFORM_VECTORS.
 * Keep at least 82 vectors available for lighting and engine uniforms. Fail
 * closed to the same surveyed #221 geometry on unknown/under-budget hardware. */
export const PRINCE_SKY_MIN_FRAGMENT_UNIFORM_VECTORS=192;
export const princeSkyBudget=(available:number)=>Number.isFinite(available)&&available>=PRINCE_SKY_MIN_FRAGMENT_UNIFORM_VECTORS;
