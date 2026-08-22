# Setframe Product Backlog — Gym UX Review

## Purpose

This folder converts the August 22 gym usability review into individually implementable stories with Copilot steering guidance.

## Delivery Standards

All stories use the following product rules:

- Mobile-first responsive web implementation.
- Every web user-facing change must also be implemented in the mobile application.
- Mobile web and mobile app must be compared for behavioral and visual parity.
- GitHub reviewer sign-off for code/implementation quality.
- Figma reviewer sign-off for visual/design parity.
- Acceptance criteria and Definition of Done must be satisfied before closure.

## Stories

1. [Simplify Guided Setup Exercise Addition](./01-guided-setup-exercise-add-flow.md)
2. [Restore and Protect the Preloaded Exercise Catalog](./02-exercise-catalog-availability.md)
3. [Allow Exercise Correction During Guided Setup](./03-guided-setup-remove-edit-exercises.md)
4. [Redesign Responsive Workout-to-Day Scheduling](./04-responsive-program-schedule-assignment.md)
5. [Improve Today Workout Preview on Mobile](./05-today-workout-preview-mobile.md)
6. [Replace Start/Resume State with Completed Workout Review](./06-today-completed-workout-state.md)
7. [Investigate Morning Weight Completion Carryover](./07-morning-weight-date-scoping-bug.md)

## Suggested Implementation Order

### Guided setup
Stories 02 → 01 → 03 → 04

Fix the canonical exercise data source before redesigning the interaction that consumes it.

### Today
Stories 07 → 06 → 05

Confirm daily/date state correctness, then workout lifecycle state, then preview polish.

The two tracks can be worked independently if the code ownership allows it.
