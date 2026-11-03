# E Auctions — 360 / AR promotional microsite

**New standalone marketing microsite** (not the auction system). Files in `marketing/ar-showroom` are standalone and are deployed to a separate Vercel project, not the existing auction production project.

## 360 and AR
- Uses Google `<model-viewer>` with camera controls, auto rotation and native AR on capable devices: WebXR, Android Scene Viewer, iOS Quick Look (where supported).
- 360 viewer works without AR support.
- The launch AR action must be a user gesture; mobile camera permission is mandatory.
- Current public demo model: Khronos CarConcept, © Darmstadt Graphics Group GmbH / Eric Chadwick, CC BY 4.0, with in-site credit. It is **not a model of a real listed vehicle**.
- To install the user's real Sketchfab car replace the current `model-viewer src` with a public HTTPS URL for `high-poly_3d_model_of_modern_game__render_ready.glb`, then add `ios-src` pointing to publicly served `High-Poly_3D_Model_of_Modern_Game__Render_Ready.usdz`. Files currently exist only on user's Windows D:\\ASI and were **not** available for this deployment. The files may be uploaded to Vercel Blob or public static hosting, then URLs updated here. Credit the original creator per Sketchfab CC BY requirements.

## Early access
- Separate Supabase public.enchev_ar_early_access table, INSERT-only RLS for anonymous visitors; no anonymous SELECT. Never expose service_role.
- Copy text says **-10% is a concept, pending explicit ENCHEV approval**, not a guaranteed right.
- Never present this site as a real store, app listing, or auction authority.
- Google Play app badge is labeled coming soon, no fake store link.
- For production lead campaigns, add a privacy policy/controller details, retention period, anti-spam/rate limiting, email verification and abuse monitoring.

## Source and deployment
- GitHub feature branch: `feature/e-auctions-ar-showroom-20261027` in `SoulFlameAdmin/enchev-auctions`; production auction branch untouched.
- Vercel project `e-auctions-ar-showroom` is deployed independently by direct file deployment. Future Git-based CI requires linking a reviewed, dedicated repository/project and is not enabled.
- `index.html` contains the full static microsite. To deploy from extracted folder, publish this directory as a static website.
