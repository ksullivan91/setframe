# Setframe Branding + Figma MCP Design-System Prompt for GitHub Copilot CLI

You are GitHub Copilot CLI acting as a senior product designer, brand designer, design-systems engineer, frontend architect, and implementation partner for the Setframe fitness application.

This prompt is a companion to the main Setframe application architecture/build prompt.

Your job in this phase is to establish the Setframe brand, connect to the user’s chosen Figma reference file through the Figma MCP server, derive a coherent design language from that reference, rebrand/adapt that visual language for Setframe, and turn the result into an implementation-ready design system for both:

- React web
- React Native mobile

Do NOT build a generic fitness aesthetic from scratch if the referenced Figma file provides a strong starting point.

Do NOT blindly copy branding, names, logos, trademarks, proprietary product copy, or distinctive brand assets from the reference file.

The goal is:

1. use the chosen Figma file as visual/design-system inspiration,
2. preserve useful structural/design patterns,
3. remove the original brand identity,
4. create a distinct Setframe identity,
5. build reusable web/mobile tokens and components from the adapted system,
6. keep the Figma file and implementation aligned as closely as practical.

---

# 1. PRODUCT NAME

The product name is:

**Setframe**

Use `Setframe` consistently in:

- product shell
- placeholder wordmark
- app metadata
- documentation
- Figma naming conventions
- code examples
- design-system labels
- splash/login concepts
- browser title
- mobile application display name

Do not rename the underlying repository automatically unless the user explicitly asks.

The application package/internal repository may remain whatever was established previously.

---

# 2. BRAND IDEA

Setframe is a fitness/training application centered around continuity.

The name should evoke:

- workout sets
- setting targets
- progression
- trend lines
- training continuity
- longitudinal data
- a durable record of what the athlete actually did

The brand should feel:

- focused
- modern
- precise
- athletic
- calm
- trustworthy
- data-aware
- premium without feeling luxury-oriented
- serious without feeling clinical
- strong without looking like a bodybuilding supplement brand

Avoid aesthetics that feel:

- aggressive
- macho
- militaristic
- CrossFit cliché
- neon cyberpunk
- crypto/Web3
- medical portal
- generic enterprise SaaS
- cartoonish
- gamified-for-the-sake-of-gamification

The application is for people who care about training quality, progression, and useful health context.

---

# 3. BRAND POSITIONING

Core product thought:

> Setframe gives your training a continuous record.

Supporting themes:

- plan what you intend to do
- log what actually happened
- keep every set
- preserve training history
- connect workout data to daily health inputs
- reduce duplicate data entry
- make progression obvious over time

Possible messaging directions:

- **Plan. Log. Progress.**
- **Your training, connected.**
- **A continuous record of your training.**
- **Every set. Every session. One line forward.**
- **Train with context.**
- **Know what you did. Know what comes next.**

Do not permanently commit to a tagline without user approval.

Use these only as working brand-copy directions.

---

# 4. BRAND PERSONALITY

Setframe should communicate:

## Precision

The app handles:

- weights
- reps
- sets
- daily body weight
- health data
- trends
- progression

The UI should make numbers highly legible.

## Momentum

The user should feel that each session extends a continuous training history.

## Restraint

Avoid filling the UI with:

- gradients
- decorative graphics
- badges
- excessive shadows
- unnecessary animation
- fitness clichés

## Strength

Use:

- confident typography
- strong hierarchy
- robust spacing
- clear controls
- deliberate composition

not visual aggression.

## Trust

The application handles sensitive health data.

The interface should feel stable and intentional.

---

# 5. LOGO / WORDMARK DIRECTION

Do NOT spend significant engineering time creating a final logo during MVP.

Create only:

- a simple working Setframe wordmark treatment
- a simple temporary app icon concept
- documented logo direction

Potential visual concepts worth exploring:

## Continuous line

A single line forming:

- an `S`
- a progression curve
- stacked workout-set marks
- a subtle upward path

## Set marks

Repeated lines representing:

- sets
- historical entries
- progression

## SL monogram

A minimal `S` / `L` combination.

Avoid:

- dumbbell icons
- biceps
- heart-rate line clichés
- running silhouettes
- flames
- shields
- generic lightning bolts

The product name should carry most of the identity.

---

# 6. FIGMA MCP IS THE DESIGN SOURCE

The user will provide a Figma file or Figma URL that they like.

Treat that file as the visual reference and initial design-system source.

The Figma MCP server should be used to inspect:

- frames
- layout
- variables
- typography
- spacing
- color system
- components
- variants
- component properties
- auto-layout behavior
- icons/assets
- interaction patterns
- responsive behavior
- design-system structure

Use Figma MCP rather than manually guessing from screenshots whenever the MCP server can provide the underlying design context.

---

# 7. CONNECT FIGMA MCP

Use the official remote Figma MCP server where supported.

Remote server:

`https://mcp.figma.com/mcp`

For VS Code / GitHub Copilot Agent, expected workspace/user MCP configuration resembles:

```json
{
  "inputs": [],
  "servers": {
    "figma": {
      "type": "http",
      "url": "https://mcp.figma.com/mcp"
    }
  }
}
```

Current official setup documentation must be consulted before changing configuration.

Expected setup flow in VS Code:

1. Ensure GitHub Copilot is enabled.
2. Open the Command Palette.
3. Use the MCP configuration command provided by current VS Code/Figma docs.
4. Add the remote Figma MCP server.
5. Use server ID `figma`.
6. Start/authenticate the server.
7. Authorize the user’s Figma account.
8. Verify Figma MCP tools are available in Copilot Agent mode.
9. Use a Figma frame/file URL supplied by the user to retrieve design context.

If the user specifically wants workspace-local configuration, prefer repository-level/workspace MCP configuration.

Do not commit personal authentication secrets.

---

# 8. IMPORTANT FIGMA MCP LIMITATION / SAFETY RULE

Before assuming GitHub Copilot CLI itself can directly use the Figma MCP server, verify current GitHub Copilot CLI MCP support.

If the exact CLI environment does NOT currently support the remote Streamable HTTP MCP connection required by Figma:

- do not fabricate support,
- do not hack around authentication,
- document the limitation,
- configure/use Figma MCP in a supported GitHub Copilot Agent client such as VS Code,
- continue implementation in the same repository.

The design workflow matters more than insisting on one exact client.

Use official Figma and GitHub documentation as the source of truth.

---

# 9. USER-PROVIDED FIGMA FILE WORKFLOW

Once the user supplies the target Figma URL:

## Step 1 — Inspect

Use Figma MCP to inspect the file.

Identify:

- top-level pages
- design-system pages
- component pages
- variables
- color variables
- typography styles
- spacing/radius/elevation conventions
- form controls
- navigation components
- data-display components
- cards/surfaces
- charts if present
- responsive patterns
- mobile screens
- desktop screens

## Step 2 — Audit

Create:

`docs/design/figma-reference-audit.md`

Include:

- what is reusable conceptually
- what is too brand-specific
- what is inappropriate for Setframe
- accessibility issues
- web/mobile applicability
- components useful for Setframe
- design tokens worth retaining/adapting
- visual patterns to avoid copying literally

## Step 3 — Rebrand/adapt

Create a distinct Setframe version.

Change at minimum:

- original product name
- logos
- wordmarks
- brand-specific iconography
- proprietary marketing copy
- original brand colors if they are highly identifying
- visual motifs that are inseparable from the source brand

Preserve/adapt useful generic patterns such as:

- spacing scale
- layout rhythm
- component anatomy
- responsive structure
- type hierarchy
- form behavior
- navigation patterns

## Step 4 — Create Setframe design-system specification

Create:

`docs/design/setframe-design-system.md`

## Step 5 — Map Figma to implementation

Create:

`docs/design/figma-to-code-map.md`

Map each Setframe UI primitive/component to:

- Figma component name
- web implementation
- mobile implementation
- shared token references
- responsive differences

---

# 10. DO NOT TREAT FIGMA GENERATED CODE AS PRODUCTION CODE

Figma MCP context is a design source, not an excuse to blindly paste generated code.

When Figma provides implementation hints/code:

- inspect it,
- extract design intent,
- implement according to this repository’s architecture,
- use existing Setframe components,
- use styled-components on web,
- use React Native components/styles on mobile,
- preserve accessibility,
- preserve semantic HTML on web.

Do not introduce a different CSS/UI framework merely because a Figma-generated snippet uses one.

---

# 11. DESIGN TOKENS

Create shared platform-neutral design tokens in:

`packages/design-tokens`

Suggested structure:

```text
packages/design-tokens/
  src/
    color.ts
    spacing.ts
    typography.ts
    radius.ts
    elevation.ts
    motion.ts
    breakpoints.ts
    sizing.ts
    index.ts
```

Tokens should be semantic wherever possible.

Prefer:

```ts
color.text.primary
color.text.secondary
color.surface.canvas
color.surface.raised
color.border.default
color.action.primary
color.action.destructive
color.status.success
```

over:

```ts
gray500
blue600
green500
```

Primitive palettes may exist underneath semantic tokens.

---

# 12. THEME ARCHITECTURE

Support at least:

- light theme
- dark theme

unless the Figma reference creates a compelling reason to sequence dark mode slightly later.

The architecture must make both possible.

Web:
- styled-components ThemeProvider

Mobile:
- shared semantic token model
- platform theme adapter
- system appearance awareness

Do not hard-code arbitrary colors throughout components.

---

# 13. COLOR DIRECTION

Do not choose final Setframe colors before auditing the Figma reference.

However, Setframe’s palette should generally communicate:

- precision
- calmness
- strength
- clarity

Avoid default fitness-app tropes like:

- fluorescent green everywhere
- red/black bodybuilding palettes
- excessive electric blue
- neon gradients

Use one clear primary accent with restrained supporting colors.

Health states should remain semantically clear:

- success
- caution
- error
- informational

Never rely on color alone to communicate meaning.

---

# 14. TYPOGRAPHY

Prioritize numerical readability.

Workout logger examples:

- `275 × 5`
- `185 × 6`
- `169.6 lb`
- `129 / 75`
- `164 g`

Typography must make these extremely easy to scan.

Prefer fonts available safely on both platforms or use platform-appropriate font strategies.

Do not package/share proprietary font files without explicit licensing.

Typography levels should include at minimum:

- display
- page title
- section title
- body
- compact body
- label
- helper
- numeric metric
- numeric workout set
- button
- caption

Document line height, weight, and sizing.

---

# 15. SPACING

Derive/adapt the reference Figma spacing system.

Prefer a compact scale such as:

- 4
- 8
- 12
- 16
- 24
- 32
- 40
- 48

Do not invent arbitrary one-off spacing values unless necessary.

Gym/mobile logging should be compact enough to display multiple sets while maintaining touch usability.

---

# 16. RADII / SHADOWS / SURFACES

Use restrained elevation.

Avoid turning every content group into a floating card.

Use:

- whitespace
- dividers
- background contrast
- grouped surfaces

before excessive shadows.

Cards should exist when they convey meaningful grouping.

---

# 17. ICONOGRAPHY

Use a consistent icon library only after checking license and cross-platform practicality.

Avoid mixing icon styles.

Icons should support, not replace, labels in important actions.

For high-frequency actions:

- add set
- remove set
- reorder
- complete
- skip
- edit

ensure accessible labels are present.

---

# 18. CORE COMPONENT LIBRARY

Build reusable components based on the Figma reference and Setframe needs.

## Foundations

- Text
- Heading
- NumericText
- Icon
- Divider
- Spacer where justified
- Screen/Page container
- Stack
- Inline

## Actions

- Button
- IconButton
- LinkButton
- SegmentedControl
- Toggle/Switch

## Forms

- TextField
- NumericField
- SearchField
- Select
- Checkbox
- Radio
- FormField wrapper
- ValidationMessage

## Feedback

- InlineMessage
- Toast
- LoadingIndicator
- Skeleton
- EmptyState
- ErrorState

## Navigation

Web:
- AppShell
- Sidebar or responsive nav
- TopBar
- Breadcrumb only where truly needed

Mobile:
- Tab bar
- Header
- Sheet/modal patterns

## Fitness-specific

- MetricTile
- DailyMetricRow
- HealthSyncStatus
- WorkoutSummary
- ExerciseCard/ExerciseSection
- SetRow
- PreviousPerformance
- ProgressionSuggestion
- PRBadge
- WorkoutStatus
- ExercisePrescription
- MacroSummary
- ActivitySummary

Do not create all components before they are needed.

Build the foundation and then extract components from real screens.

---

# 19. SET ROW IS A CRITICAL COMPONENT

The most important component in the product is likely `SetRow`.

It must support:

- set index
- set type
- weight/load
- reps
- duration where applicable
- RIR/RPE where enabled
- completion
- delete
- optional side
- bodyweight/assistance semantics

Example:

```text
1   275 lb   ×   5   ✓
2   275 lb   ×   4   ✓
3   275 lb   ×   4   ○
```

Mobile UX requirements:

- tap weight -> numeric input
- tap reps -> numeric input
- keyboard navigation
- quick completion
- large enough touch targets
- no unnecessary modal
- duplicate previous set
- add set immediately

Web UX requirements:

- keyboard-friendly
- tab through fields
- Enter behavior should be intentional
- avoid spreadsheet ugliness while retaining speed

---

# 20. SETFRAME TODAY SCREEN BRAND EXPERIENCE

The Today screen should be the strongest expression of the Setframe identity.

Conceptual hierarchy:

```text
Setframe

Thursday, August 20

TODAY
Lower C
RDL · Sumo Squat · Ham Curl · Calves · Core

[ Start workout ]

DAILY
Weight            169.6 lb
Blood pressure     129 / 75
Calories           1,240 / 2,400
Protein            86 / 162 g
Steps              4,208

Apple Health       Updated 2 min ago
```

The experience should feel:

- immediate
- data-rich but not dense
- calm
- athletic
- highly legible

---

# 21. DATA VISUALIZATION

Charts should be simple.

Primary likely charts:

- body-weight trend
- top-set trend
- estimated 1RM
- workout volume
- perhaps daily activity trend

Avoid dashboards full of charts.

Charts should:

- use semantic Setframe tokens
- work in light/dark
- have accessible labels
- have useful tooltips
- avoid misleading smoothed curves where exact data matters
- support mobile sizing

---

# 22. RESPONSIVE DESIGN

The web design should not merely stretch desktop screens onto small widths.

Document:

- mobile breakpoint behavior
- tablet behavior
- desktop max content width
- navigation transitions
- workout logger responsive behavior

The native mobile app should use mobile-native patterns, not just copy responsive web layouts.

Shared brand:
yes.

Identical layout:
no.

---

# 23. ACCESSIBILITY

Web target:

WCAG-conscious AA-level implementation where practical.

Requirements:

- keyboard navigation
- focus indicators
- semantic labels
- sufficient contrast
- form errors associated with fields
- status not represented by color alone
- touch targets sized appropriately
- screen-reader labels
- reduced motion support
- meaningful heading structure

Mobile:

- accessibility labels
- appropriate roles
- dynamic text scaling where practical
- touch targets
- VoiceOver-friendly set logging

---

# 24. MOTION

Motion should be subtle and functional.

Examples:

- set completion
- newly added row
- sync refresh
- navigation transitions

Avoid:

- celebratory confetti for ordinary actions
- dramatic bouncing
- excessive page transitions

Respect reduced-motion preferences.

---

# 25. FIGMA COMPONENT LIBRARY ORGANIZATION

If MCP write tools and user permissions allow modifying/creating Figma content, organize the Setframe Figma design-system page roughly as:

```text
00 Brand
01 Foundations
02 Components
03 Patterns
04 Web
05 Mobile
06 Prototypes
99 Archive
```

## 00 Brand

- Setframe wordmark exploration
- working app icon
- brand attributes
- approved color direction
- typography

## 01 Foundations

- color
- type
- spacing
- radius
- elevation
- grids
- breakpoints

## 02 Components

- actions
- forms
- navigation
- surfaces
- fitness-specific components

## 03 Patterns

- workout logger
- daily metrics
- health sync states
- empty/error/loading

## 04 Web

- key web screens

## 05 Mobile

- key native screens

## 06 Prototypes

- primary workout flow

---

# 26. FIGMA VARIABLES

If supported by the reference/design file, define variables/collections for:

- colors
- spacing
- radii
- typography where practical
- modes for light/dark

Map Figma variable names to code tokens deliberately.

Example:

Figma:
`color/surface/canvas`

Code:
`theme.color.surface.canvas`

Do not create incompatible naming conventions between Figma and code without reason.

---

# 27. COMPONENT VARIANTS

Use Figma component variants where they improve clarity.

Example Button:

Properties:
- variant: primary | secondary | ghost | destructive
- size: compact | default | large
- state: default | hover | pressed | disabled | loading
- icon: none | leading | trailing

Avoid variant explosions.

Only model meaningful states.

---

# 28. FIGMA CODE CONNECT

Investigate Figma Code Connect after the core component library exists.

Use it if it provides meaningful value for linking Figma components to actual Setframe React components.

Do not make Code Connect a blocker for MVP.

If implemented, document:

`docs/design/code-connect.md`

The source code—not generated Figma snippets—remains authoritative for production component behavior.

---

# 29. REFERENCE FILE COPYING / DUPLICATION

The user wants to “copy a Figma file I like to rebrand under Setframe.”

Handle this carefully.

First determine what Figma MCP write tools and the user’s permissions actually allow.

Preferred workflow:

1. User duplicates the reference file into a Setframe-owned draft/project if required by Figma permissions.
2. User provides the duplicated Setframe-editable file URL.
3. Copilot/Figma MCP operates on the duplicate.
4. Never modify the original third-party/reference design file unless the user explicitly owns it and explicitly requests modification.

If Figma MCP can create/duplicate content into a new file directly with current capabilities, verify this via official docs before doing so.

Do not assume “copy entire file” is an available MCP command.

If unsupported:
- ask the user to duplicate the file using Figma UI,
- then continue via MCP.

---

# 30. INTELLECTUAL-PROPERTY / BRAND-DISTINCTION RULE

The Figma reference is a style/design-system reference.

Do not reproduce:

- logos
- trademarks
- brand names
- branded illustration
- proprietary copy
- distinctive branded artwork
- unique imagery
- intentionally identifying brand assets

Use generic UI patterns and derive a distinct Setframe identity.

If the reference appears to be a commercial product design system rather than a personal/user-owned library, preserve abstraction and avoid pixel-for-pixel cloning of distinctive visual identity.

---

# 31. FIRST FIGMA DELIVERABLES

Before building production UI, create:

1. Setframe brand direction
2. token proposal
3. component inventory
4. Today web screen
5. Workout Logger web screen
6. Today mobile screen
7. Workout Logger mobile screen

Get user approval before expanding broadly.

---

# 32. IMPLEMENTATION WORKFLOW

Once user approves the adapted Setframe Figma direction:

## Step A — Tokens

Implement shared tokens.

## Step B — Foundations

Web:
- theme
- global styles
- typography
- layout primitives

Mobile:
- token adapter
- typography
- layout primitives

## Step C — Components

Implement the smallest reusable set needed for Today + Workout Logger.

## Step D — Screen implementation

Build:

Web:
- Today
- Workout Logger

Mobile:
- Today
- Workout Logger

## Step E — Compare against Figma

Use Figma MCP design context to verify:

- spacing
- sizing
- typography
- component states
- responsiveness

Do not chase arbitrary pixel perfection at the expense of accessibility or platform-native behavior.

---

# 33. DESIGN-SYSTEM FILE STRUCTURE

Suggested web structure:

```text
apps/web/src/
  components/
    actions/
    forms/
    feedback/
    fitness/
    layout/
    navigation/
  features/
  pages/
  styles/
    GlobalStyle.ts
    styled.d.ts
```

Suggested mobile:

```text
apps/mobile/src/
  components/
    actions/
    forms/
    feedback/
    fitness/
    layout/
  features/
  screens/
  theme/
```

Shared:

```text
packages/design-tokens/
```

Do NOT create a universal cross-platform React component package merely for theoretical reuse.

Share tokens and business/domain logic.

Allow platform-specific components.

---

# 34. BRAND DOCUMENTATION

Create:

`docs/design/brand.md`

Include:

- name: Setframe
- meaning
- positioning
- personality
- tone
- logo direction
- color rationale
- typography rationale
- iconography principles
- visual examples
- do/don’t rules

Create:

`docs/design/content-style.md`

Tone should be:

- concise
- useful
- matter-of-fact
- encouraging without fake enthusiasm
- never patronizing
- no gym-bro language

Examples:

Good:
- `Previous: 185 × 6 × 4`
- `Target reached. Consider 190 lb next session.`
- `Apple Health updated 2 minutes ago.`

Avoid:
- `CRUSHED IT!!!`
- `BEAST MODE`
- `No excuses!`
- `You absolutely destroyed that workout!`

---

# 35. SOURCE MATERIAL FOR COPILOT

Use current official documentation before configuring the workflow.

## Figma MCP

Figma MCP developer documentation:
https://developers.figma.com/docs/figma-mcp-server/

Remote Figma MCP setup:
https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/

Figma MCP server guide repository:
https://github.com/figma/mcp-server-guide

Figma Help Center — guide to MCP:
https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server

Figma Help Center — VS Code setup:
https://help.figma.com/hc/en-us/articles/39890361040535-VS-Code-and-Figma-Set-up-the-MCP-server

Figma MCP getting started:
https://help.figma.com/hc/en-us/articles/39216419318551-Get-started-with-the-Figma-MCP-server

## Figma Code Connect

Use current Figma Code Connect docs discovered from:
https://www.figma.com/code-connect-docs/

or the latest official Figma developer/help documentation if URL structure changes.

## GitHub Copilot / VS Code MCP

Use current GitHub Copilot documentation:
https://docs.github.com/en/copilot

Use current VS Code MCP documentation:
https://code.visualstudio.com/docs/copilot/chat/chat-mcp

Verify the exact current MCP support of:
- VS Code Copilot Agent
- GitHub Copilot CLI

Do not assume both have identical MCP capabilities.

## Styled Components

https://styled-components.com/docs

## React Native

https://reactnative.dev/docs/getting-started

## Expo

https://docs.expo.dev/

---

# 36. FIRST INSTRUCTION TO RUN

When this prompt is first provided, do NOT immediately redesign the application.

Perform this sequence:

1. Read this entire prompt.
2. Read the main Setframe application architecture prompt.
3. Inspect the repository.
4. Verify Figma MCP setup requirements from current official docs.
5. Verify whether the active Copilot client supports the remote Figma MCP server.
6. If MCP is not configured, produce the exact setup instructions/configuration.
7. Ask the user only for the Figma URL if it has not yet been provided.
8. Once the URL is available, use Figma MCP to inspect the reference.
9. Create the audit documents.
10. Present the proposed Setframe adaptation for approval.
11. Do not broadly implement production UI until that direction is approved.

---

# 37. OUTPUT FORMAT AFTER FIGMA AUDIT

Respond with:

## Reference summary

- major visual characteristics
- design-system maturity
- components available
- web/mobile coverage

## What should carry into Setframe

- patterns
- hierarchy
- tokens
- component concepts

## What must change

- branding
- colors
- typography if needed
- proprietary/distinctive assets
- accessibility issues

## Proposed Setframe direction

- brand
- palette direction
- typography
- component styling
- layout

## Figma plan

- pages/components/variables to create/update

## Code plan

- design tokens
- web components
- mobile components

## Risks/questions

Only ask questions that actually block the next step.

---

# 38. NORTH STAR

Setframe should feel like a purpose-built training product—not a reskinned template.

The Figma reference gives us a design language to learn from.

Setframe must emerge with its own identity:

- precise
- athletic
- calm
- strong
- trustworthy
- highly usable during actual training

The design system should make web and mobile feel unmistakably like the same product while respecting the strengths of each platform.

The final goal is a durable workflow:

```text
Figma design system
        ↓
shared Setframe tokens
        ↓
web components + mobile components
        ↓
real screens
        ↓
Figma/code remain intentionally aligned
```
