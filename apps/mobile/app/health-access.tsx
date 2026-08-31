import { HealthAccessScreen } from '../src/screens/HealthAccessScreen';

/**
 * Pre-permission priming, pushed from Today's Apple Health card. Drawn as
 * a pushed screen rather than a sheet because the content scrolls and
 * deserves a back affordance — see docs/design/health-connection-flow.md.
 */
export default function HealthAccessRoute() {
  return <HealthAccessScreen />;
}
