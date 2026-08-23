import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement scrollTo (used by Modal's scroll-lock restore,
// Story 20) and logs a noisy "Not implemented" error for every test that
// opens a dialog — stub it so real component behavior isn't drowned out.
window.scrollTo = () => {};
