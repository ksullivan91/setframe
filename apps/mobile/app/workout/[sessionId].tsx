/**
 * The canonical workout route renders v2.
 *
 * Versioning lives in the screen file names, not the route — v1 stays in the
 * tree at `src/screens/WorkoutSessionScreenV1.tsx`, unrouted, until these
 * changes are approved and it can be deleted. Both screens live under `src/`
 * rather than `app/` because expo-router turns every file under `app/` into a
 * route, and an unrouted v1 sitting there would still be reachable.
 */
export { default } from '../../src/screens/WorkoutSessionScreenV2';
