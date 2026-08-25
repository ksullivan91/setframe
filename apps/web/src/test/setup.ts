import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement scrollTo (used by Modal's scroll-lock restore,
// Story 20) and logs a noisy "Not implemented" error for every test that
// opens a dialog — stub it so real component behavior isn't drowned out.
window.scrollTo = () => {};

// jsdom doesn't implement scrollIntoView either (used by Story 39's
// single-active-exercise accordion to bring a newly-activated exercise
// into view) — same gap, same fix.
Element.prototype.scrollIntoView = () => {};
