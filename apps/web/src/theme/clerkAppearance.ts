import type { Appearance } from '@clerk/types';
import { colorRamps, fontFamily, fontWeight, radius, spacing } from '@setframe/design-tokens';
import { typeScale } from './typeScale';

/**
 * Maps Setframe's design tokens onto Clerk's `appearance` API so the
 * embedded <SignIn/>/<SignUp/> forms match the Figma auth screens
 * (style guide §10/§13) instead of Clerk's own default look. Light
 * theme only for now — mirrors getTheme()'s current light-only default;
 * revisit if/when dark mode ships.
 */
export const clerkAppearance: Appearance = {
  theme: 'simple',
  variables: {
    colorPrimary: colorRamps.accent[600],
    colorText: colorRamps.neutral[900],
    colorTextSecondary: colorRamps.neutral[600],
    colorBackground: colorRamps.neutral[0],
    colorInputBackground: colorRamps.neutral[0],
    colorInputText: colorRamps.neutral[900],
    colorDanger: colorRamps.status.error,
    colorSuccess: colorRamps.status.success,
    colorWarning: colorRamps.status.caution,
    fontFamily: fontFamily.base,
    fontWeight: {
      normal: Number(fontWeight.regular),
      medium: Number(fontWeight.semiBold),
      semibold: Number(fontWeight.semiBold),
      bold: Number(fontWeight.semiBold),
    },
    borderRadius: `${radius.small}px`,
    spacingUnit: `${spacing[4]}px`,
  },
  elements: {
    rootBox: {
      width: '100%',
    },
    cardBox: {
      width: '100%',
      boxShadow: 'none',
      border: 'none',
    },
    card: {
      width: '100%',
      boxShadow: 'none',
      border: 'none',
      padding: 0,
    },
    header: {
      display: 'none',
    },
    // NOTE: Figma's SignIn/SignUp frames (node 17:2) illustrate a simplified
    // email+password-only mock, but the app's real auth flow is Google
    // OAuth — do NOT hide socialButtonsBlockButton/dividerRow, that would
    // remove the only sign-in method actually in use.
    // NOTE: the "Secured by Clerk / Development mode" badge is not part of
    // the customizable elements config — it's a fixed indicator only shown
    // on Development Clerk instances (see Clerk's environments docs) and
    // will disappear automatically once we switch to a Production instance
    // + custom accounts.setframe.app domain (holstered per user request).
    formButtonPrimary: {
      fontSize: `${typeScale.button.fontSize}px`,
      fontWeight: typeScale.button.fontWeight,
      borderRadius: `${radius.small}px`,
      backgroundColor: colorRamps.accent[600],
      '&:hover': {
        backgroundColor: colorRamps.accent[700],
      },
    },
    formFieldInput: {
      borderRadius: `${radius.small}px`,
      borderColor: colorRamps.neutral[200],
      fontSize: `${typeScale.body.fontSize}px`,
    },
    formFieldLabel: {
      fontSize: `${typeScale.label.fontSize}px`,
      color: colorRamps.neutral[600],
    },
    socialButtonsBlockButton: {
      borderRadius: `${radius.small}px`,
      borderColor: colorRamps.neutral[200],
      fontSize: `${typeScale.body.fontSize}px`,
    },
    dividerLine: {
      backgroundColor: colorRamps.neutral[200],
    },
    dividerText: {
      color: colorRamps.neutral[600],
      fontSize: `${typeScale.caption.fontSize}px`,
    },
    footerActionLink: {
      color: colorRamps.accent[600],
      '&:hover': {
        color: colorRamps.accent[700],
      },
    },
  },
};
