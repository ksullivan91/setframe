# Setframe Product Backlog — Mobile Unit Label Fix

## Purpose

This pack captures a responsive form-field issue found during real mobile workout logging.

The current inline `lb` adornment can be pushed outside the Weight input at narrow widths.

## Story

22. [Move Unit Labels Out of Numeric Inputs on Small Screens](./22-mobile-unit-labels.md)

## Product Guidance

Prefer:

`Weight (lb)`

over embedding `lb` inside the numeric input.

This reduces responsive pressure and keeps the user's measurement unit explicit.

Audit the shared numeric-input component so the fix applies consistently across Setframe rather than only to one workout screen.
