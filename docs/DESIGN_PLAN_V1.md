# ENCHEV AUCTIONS — DESIGN PLAN v1.0

Reference site: https://www.autobidmaster.com/
Design ChatGPT session: https://chatgpt.com/c/6aab25f8-e68c-83eb-ba1a-9e3fda3d5eb7

## Rule
Use AutoBidMaster only as a live UX/information-architecture reference. Do not copy its branding, logo, proprietary text, images, source code or exact visual identity. ENCHEV keeps its own brand, components, copy, assets and code.

## Execution protocol
- Work in task order D01 → D36 unless a dependency requires a tightly related block.
- Use GitHub and Vercel for real implementation and production proof.
- Supabase only when a design interaction genuinely needs data/runtime integration.
- GREEN only after implementation + relevant visual/function test + evidence.
- Update `app/design-plan-evidence.json` after every proven design task.
- When complete, end the ChatGPT response with `OK`.
- If blocked, end with `PROBLEM IN: <exact blocker>` and DAVID will request a safe fix attempt.

## Design tasks
The canonical machine-readable list is `app/design-plan-evidence.json` (D01–D36). It covers:
1. Foundation/design system
2. Homepage information architecture
3. Inventory/search/filter experience
4. Lot details experience
5. Live-auction experience
6. Buyer workspace/profile
7. Responsive/accessibility/cross-browser/visual-regression certification

## Reference behaviors to study
AutoBidMaster currently exposes major navigation for finding vehicles, live auctions, shipping, vehicle history and support, and its landing experience emphasizes search/inventory/live auction discovery. Use those interaction patterns as research input, not as copied design.

## Completion
Design is 100% only when every D01–D36 task is GREEN with evidence in `app/design-plan-evidence.json` and the production routes are visually/functionally verified.