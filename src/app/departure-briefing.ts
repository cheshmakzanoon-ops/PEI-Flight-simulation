import { regionalCanopyRequested, standardRegionalCanopyRequested, explicitDuneGrassRequested, sceneryOptions, standardBasinSandRequested, standardDuneGrassRequested, seacowExteriorRequested, dalvayWaterRequested } from './scenery-profile.ts';
import { pointPrimRequested } from '../render/point-prim/admit.ts';
import type { Site } from '../sim/places.ts';

const coastalGrass = new Set(['prince-coastal-grass', 'queens-coastal-grass', 'kings-coastal-grass']);

/** Describe the selected settings, not the actual success of streamed data.
 * A missing source may still leave the stock scenery in the running game. */
export function departureBriefing(site: Site, search: string): string {
  const options = sceneryOptions(search);
  if (site.id === 'dalvay-lake-coastal-pass') {
    return site.note + (dalvayWaterRequested(options) ?
      ' The lake reflection preview is enabled in these scenery settings.' :
      ' The lake reflection preview is off in these scenery settings.');
  }
  if (site.id === 'seacow-head-coast') {
    return site.note + (seacowExteriorRequested(options) ?
      ' Look for the tapered white tower and red lantern as the exterior streams in.' :
      ' The authored exterior is off with these scenery settings.');
  }
  if (site.id === 'point-prim-offshore') {
    return site.note + (pointPrimRequested(options) ?
      ' The surveyed lighthouse and its small dry-ground correction can appear on approach.' :
      ' The surveyed lighthouse is off with these scenery settings.');
  }
  if (site.id === 'basin-head-low') {
    return site.note + (options.has('basinSand') || standardBasinSandRequested(options) ?
      ' Look for the pale sand on the seaward beach as you approach.' :
      ' The pale sand treatment is off with these scenery settings.');
  }
  if (site.id === 'queens-canopy-pass' || site.id === 'kings-canopy-pass') {
    return site.note + (standardRegionalCanopyRequested(options) || regionalCanopyRequested(options) ?
      ' Look for denser crowns above the measured stand; the clearings stay open.' :
      ' The measured canopy treatment is off with these scenery settings.');
  }
  if (coastalGrass.has(site.id)) {
    return site.note + (explicitDuneGrassRequested(options) || standardDuneGrassRequested(options) ?
      ' Look for close grass detail over the surveyed coastal plots.' :
      ' The close grass treatment is off with these scenery settings.');
  }
  return site.note;
}
