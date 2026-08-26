# Setframe Progress Experience Rebuild

## Why this feature family exists

The Progress page is not a reporting afterthought. It is one of the primary reasons a user should be willing to consistently enter data into Setframe.

Logging weight, workouts, sets, reps, volume, Additional Activity, and eventually Apple Health data creates friction. The product must repay that effort with understanding, context, visible progress, pattern recognition, motivation, and eventually intelligent insights/coaching.

## Product north star

A user should be able to open Progress and quickly answer:

1. What is changing?
2. Over what period?
3. Is this different from my recent baseline?
4. What caused the change?
5. What should I pay attention to next?

The first four should be answerable with deterministic analytics and visualization. The fifth becomes increasingly important as Setframe adds OpenAI-powered insights later.

## Current problems from the latest review

- Tooltip placement is not intelligently anchored.
- Tooltips can render near the top of the document instead of beside the triggering control.
- Switching from one tooltip to another often requires two taps.
- The new charts largely retained the old information architecture.
- Requested week/month/3M/6M/year controls were not implemented.
- Adding a month label is not the same as changing aggregation and interaction.
- Charts lack context, selected-value detail, and exploration.
- The page still feels like static reporting instead of a core product experience.

## Story order

46. Rebuild contextual help / tooltip positioning and interaction  
47. Charting technology spike and shared visualization architecture  
48. Universal Progress time-range and interaction model  
49. ~~Rebuild Body Weight as the reference-quality chart~~ — shipped, see `Backlog/completed/`  
50. Rebuild Training Frequency and Weekly Volume charts  
51. Create an insight-ready Progress metric architecture

## Recommended delivery

**Phase A:** 46 → 47 → 48  
**Phase B:** 49  
**Phase C:** 50  
**Phase D:** 51

## Non-negotiable instruction to Claude

Do not “enhance” the existing charts cosmetically and call the work complete.

For Stories 47–50 Claude must:
1. inspect the current chart implementation,
2. decide whether it supports the specified interactions,
3. replace the chart technology if necessary,
4. implement real period controls and real aggregation semantics,
5. validate mobile web and mobile app,
6. provide evidence/screenshots for acceptance criteria.

If the current chart library cannot deliver the required interaction cleanly, that is evidence to change the library — not permission to omit the interaction.

## Research / Reference Sources

1. Apple — Design an effective chart (WWDC22): https://developer.apple.com/videos/play/wwdc2022/110340/
2. Apple Human Interface Guidelines — Charts: https://developer.apple.com/design/human-interface-guidelines/charts
3. MyFitnessPal — Progress / measurement history: https://support.myfitnesspal.com/hc/en-us/articles/360032624431-How-do-I-record-my-weight-and-other-measurements
4. Victory Native XL: https://github.com/FormidableLabs/victory-native-xl
5. React Native ECharts: https://github.com/wuba/react-native-echarts

