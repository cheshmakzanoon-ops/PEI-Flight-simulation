import {makeCharlottetownFssExterior,type FssLod} from './fss-exterior.ts';

export const artStatus='Original detached exterior. Working proportions; not a surveyed model.';
export function buildExterior(lod:FssLod='near'){
 return makeCharlottetownFssExterior(lod).group;
}
