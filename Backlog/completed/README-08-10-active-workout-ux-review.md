# Setframe Product Backlog — Active Workout UX Review

## Purpose

This folder converts the August 22 active-workout gym usability review into individually implementable stories with Copilot steering guidance.

These stories continue the same product-work format established in the previous Setframe gym UX review.

## Delivery Standards

All stories use the following product rules:

- Mobile-first responsive web implementation.
- Every web user-facing change must also be implemented in the mobile application.
- Mobile web and mobile app must be compared for behavioral and visual parity.
- GitHub reviewer sign-off for code/implementation quality.
- Figma reviewer sign-off for visual/design parity.
- Acceptance criteria and Definition of Done must be satisfied before closure.

## Stories

8. [Add Any Exercise Directly During an Active Workout](./08-add-exercise-during-workout-session.md)
9. [Render Workout-Session Inputs Based on Prescription Type](./09-prescription-aware-session-fields.md)
10. [Correct Personal Record Detection and PR Badge State](./10-personal-record-calculation-and-badges.md)

## Suggested Implementation Order

### 1. Story 09 — Prescription-aware session fields

This establishes the correct domain/UI mapping for the workout logger and removes the largest source of session-form noise.

### 2. Story 08 — Mid-session Add Exercise

Build the independent Add Exercise flow on top of the canonical exercise catalog and shared prescription model.

### 3. Story 10 — PR calculation

Fix PR semantics after the session model is stable so record calculations operate against authoritative, correctly typed workout data.

Story 10 can be developed in parallel if PR calculation is isolated from session representation changes.

## Product Note

The active workout UX is already directionally strong. These stories should not trigger a broad redesign of the page. The focus is:

- removing navigation dependencies
- showing only relevant logging inputs
- making achievement feedback trustworthy
