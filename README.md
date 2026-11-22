# PEI Flight Sim

**A full-province browser flight simulator for Prince Edward Island, Canada.** Built in TypeScript and rendered with Three.js.

Fly from North Cape to East Point across Prince, Queens and Kings counties. The world uses metre-scale geography. The production goal is uninterrupted island-wide flight with natural coastlines, fields, towns and airports that remain recognizable on a close approach.

> **Status: in production.** This repository is not a finished simulator. See the milestones below for what must pass before a playable release is marked ready.

## What we are building

- **World:** Province-wide terrain, water and coastlines. More detailed tiles for cities, country roads, farms, landmarks and approaches.
- **Flight:** Free flight with keyboard and gamepad, a stable chase camera and cockpit instrumentation. The flight model will be tested for takeoff, approach, stall recovery and landing.
- **Rendering:** Outdoor lighting, atmospheric perspective, red sandstone cliffs, shallow coastal water and vegetation. Detailed meshes and materials stream near the player; distant scenery uses cheaper representations.

## Production milestones

| Milestone | Exit criteria |
| --- | --- |
| Province-wide playable build | Fly over western, central and eastern PEI in one session; verify scale, coastline alignment and controls. |
| Low-altitude scenery | Validate real approaches and key landmarks; replace approximate geometry where it fails side-by-side review. |
| Release candidate | Pass repeatable visual, flight and streaming tests on documented desktop browsers and devices. |

Read the [production and acceptance gates](docs/PRODUCTION.md) for our data, review and release rules. This simulator is for recreation, not aviation training or navigation.
