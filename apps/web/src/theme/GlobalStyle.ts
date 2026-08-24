import { createGlobalStyle } from 'styled-components';
import { fontFamily } from '@setframe/design-tokens';
import { mq } from './breakpoints';
import { typeScale, mobileSafeInputFontSize } from './typeScale';

export const GlobalStyle = createGlobalStyle`
  *, *::before, *::after {
    box-sizing: border-box;
  }

  html, body, #root {
    height: 100%;
  }

  body {
    margin: 0;
    font-family: ${fontFamily.base}, system-ui, sans-serif;
    background: ${(p) => p.theme.surface.canvas};
    color: ${(p) => p.theme.text.primary};
    -webkit-font-smoothing: antialiased;
  }

  button, input, select {
    font-family: inherit;
  }

  /* Story 28 — a last-resort floor for any native form control that
     doesn't go through a shared primitive (each of which also sets this
     explicitly, since a styled-components class always outranks this bare
     element selector). Below 16px effective font size, iOS Safari
     auto-zooms on focus and the page is left visibly zoomed after blur. */
  input, textarea, select {
    font-size: ${mobileSafeInputFontSize}px;
  }

  ${mq.tablet} {
    input, textarea, select {
      font-size: ${typeScale.body.fontSize}px;
    }
  }
`;
