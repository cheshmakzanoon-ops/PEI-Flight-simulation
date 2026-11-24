import {POINT_PRIM} from './admit.ts';

export const POINT_PRIM_GRADE={
  "id": "point-prim-grade",
  "file": "point-prim-grade.bin.gz",
  "wireBytes": 1465,
  "wireSha": "b6732d103d610289a4765365e3a2b5f8ce42b85b2d657267fee9f60580a69f21",
  "decodedBytes": 28227,
  "sha256": "6e1904fc7e9b103e4451aca7394e560e8e0803cc066d12b3a7a85d589c6ed31c",
  "tileX": 18,
  "tileZ": 19,
  "firstX": 2,
  "firstZ": 100,
  "cellsX": 3,
  "cellsZ": 3,
  "sub": 32,
  "relativeToParent": true,
  "sparseRelative": true,
  "maxRelativeDeltaCm": 230,
  terrainSha256:POINT_PRIM.terrain,coverCompressedSha256:POINT_PRIM.cover,coverDecodedSha256:POINT_PRIM.coverDecoded
} as const;
