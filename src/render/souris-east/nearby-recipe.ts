/* Detached exact current stock plan/foot and source-supported surface cores only. */
export const NEIGHBOUR = {
  "owner": [
    "q130331",
    99
  ],
  "atlasSHA256": "538bcf3cb372be782e6f29d1c9226ca9d05cea9f3a0ac173b9844cc5174fe557",
  "chunkSHA256": "a7ee1263f0c19b2b570f24cf1874c0e882b895d778ad63ab3939d8adcaca7d55",
  "rowSHA256": "754e6737a77f743f9aec7d27ef4a85b7cd81107d2fe16e93efef0cfde832d9f9",
  "frame": {
    "O": [
      72537.61842999807,
      16106.40732780971
    ],
    "U": [
      0.9592013718148051,
      0.2827237667911843
    ],
    "V": [
      0.2827237667911843,
      -0.9592013718148051
    ]
  },
  "pointDatum": 13.1,
  "plan": [
    [
      9.1171905746374,
      9.930359230247458
    ],
    [
      12.229439195487469,
      9.688799750224687
    ],
    [
      12.058833194638035,
      7.552508103165334
    ],
    [
      20.071122125140093,
      7.24867157027923
    ],
    [
      19.544043139275622,
      -3.4526020934446997
    ],
    [
      8.493136371904209,
      -2.885503471248218
    ]
  ],
  "wallFeet": [
    12.987788200378418,
    13.016837120056152,
    12.94252872467041,
    13.047033309936523,
    12.689971923828125,
    12.514481544494629
  ],
  "anchor": [
    14.2,
    2.95
  ],
  "roofPlanes": {
    "mainFront": [
      23.106001822058584,
      0.043341473888208526,
      1.2102688994745538
    ],
    "mainBack": [
      23.461129676189067,
      -0.04270812223479159,
      -1.2292773226369422
    ],
    "porch": [
      19.228371551588676,
      0.007213031107857426,
      0.39528039879659504
    ],
    "rearLean": [
      19.55768515491884,
      0.00034433449359572155,
      -0.5079002035434994
    ],
    "faceSlopeWest": [
      23.203496680790437,
      1.5227460019732693,
      -0.13009071539150008
    ],
    "faceSlopeEast": [
      23.319520849630923,
      -1.5266471514137177,
      0.006627947327703554
    ]
  },
  "source": "2020 NRCan PEI direct CGVD2013 CL6 cores, q130331/99 exact plan, interpolation joins nominal in observed contact bands",
  "joinRoles": {
    "front": [
      -1.014,
      -0.032,
      0.0
    ],
    "rear": [
      7.43,
      -0.034,
      0.0
    ],
    "forwardLip": [
      -1.145,
      -0.032,
      0.0
    ],
    "maxOverlapWidth": 0.131,
    "shapeDisclaimer": "Front supported layers overlap; eave facing and bounded join plank is approximate, no exact caught lower/cavity design."
  }
} as const;
