# ADR 0006: Icon Library Selection

Status: Accepted. Date: 2026-08-20.

## Context

`setframe-branding-figma-mcp-copilot-prompt.md` §17 (Iconography) requires:
"Use a consistent icon library only after checking license and
cross-platform practicality... Avoid mixing icon styles." Several Figma
components built so far (`IconButton` ×4, drag-handle reorder glyphs,
sync-status indicators) currently use plain text-character placeholders
(`+`, `−`, `⧉`, `≡`) pending this decision, and are explicitly flagged as
such in `docs/design/setframe-figma-style-guide.md`.

The app is a single web (React) + single mobile (React Native/Expo)
codebase per the master spec, so the icon library must ship first-class
packages for both without a style mismatch between platforms.

## Options considered

| Library | License | Web package | RN/Expo package | Notes |
|---|---|---|---|---|
| **Lucide** | ISC (permissive, MIT-equivalent) | `lucide-react` | `lucide-react-native` | Fork of Feather Icons, actively maintained, single consistent line-icon style, tree-shakeable SVG components, large icon set (1000+), first-class React Native package (SVG-based, works in Expo managed + dev-client workflows without extra native linking). |
| **Phosphor Icons** | MIT | `@phosphor-icons/react` | `phosphor-react-native` (community-maintained, not official) | Good style variety (regular/bold/duotone/fill), but the RN package is community-maintained rather than published by the core Phosphor team — higher risk of drift/staleness relative to the web package. |
| **Heroicons** | MIT | `@heroicons/react` | No official RN package | Would require a separate community wrapper or manual SVG import for mobile — fails the "avoid mixing icon styles / cross-platform practicality" bar directly. |
| **Font Awesome** | Mixed (Free tier CC-BY 4.0 + Font-specific license; Pro is paid) | `@fortawesome/react-fontawesome` | `react-native-vector-icons` (bundles FA + others) | License is more complex to track (attribution requirements on Free tier, Pro tier paid), heavier bundle (icon fonts), stylistically inconsistent with the thin/line aesthetic already set by the rest of the design system. |

## Decision

Adopt **Lucide** (`lucide-react` for web, `lucide-react-native` for
mobile) as Setframe's icon library.

Rationale:
1. **License**: ISC is short, permissive, no attribution/royalty
   requirements — cleanest option checked.
2. **Cross-platform practicality**: both packages are published and
   maintained by the same core Lucide team, guaranteeing the same
   icon set/style on web and mobile without a community-wrapper gap.
3. **Style consistency**: single line-icon style (consistent stroke
   width, rounded caps) matches the restrained, non-decorative visual
   direction already established in the Setframe Figma file (thin
   strokes, subtle fills, no gradients/shadows).
4. **Practicality**: tree-shakeable SVG components in both packages
   keep bundle size proportional to actual icons used, no icon-font
   loading/FOUC concerns.

## Consequences

- Text-glyph placeholders in `IconButton`, `SetRow/Editable`
  (duplicate/remove), reorder handles, and any other component currently
  using `+`/`−`/`⧉`/`≡` characters should be swapped for the
  corresponding Lucide glyphs (`Plus`, `Minus`, `Copy`, `GripVertical`,
  `Check`, `X`, etc.) — tracked as a follow-up pass in the Figma design
  file and noted in `docs/design/setframe-figma-style-guide.md`.
- When application code begins (Phase 6+), `lucide-react` and
  `lucide-react-native` should be added to the web and mobile package
  dependency sets respectively.
