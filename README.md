# QInspired WebAR Tracking Test

Minimal public technical test for the modern 8th Wall Engine + Three.js pipeline.

## Goal

This repository deliberately contains only the WebAR tracking proof-of-concept, not the private QInspired Heritage AR documentation or backend.

The test checks:

1. mobile camera startup over HTTPS,
2. SLAM/world tracking,
3. whether a simple 3D object stays spatially anchored while the user moves,
4. a basic immersive/evidence opacity toggle.

Evidence levels used in the test:

- confirmed: opacity 1.0
- probable: opacity 0.65
- speculative: opacity 0.30

## Stack

- `@8thwall/engine-binary`
- XRExtras + Landing Page helpers
- Three.js
- Vite
- GitHub Actions / GitHub Pages

## Status

Technical tracking test only. No museum asset, hit-test placement, occlusion, production shader or backend is included yet.
