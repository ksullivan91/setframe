import { createGlobalStyle } from 'styled-components';
import { fontFamily } from '@setframe/design-tokens';

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
`;
