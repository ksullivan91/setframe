import { Navigate, Route, Routes } from 'react-router-dom';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { AppShell } from './components/AppShell';
import {
  SignInPage,
  SignUpPage,
  TodayPage,
  ProgramEditorPage,
  ProgramCreationWizardPage,
  ExerciseHistoryPage,
  ProgressPage,
  SettingsPage,
  WorkoutSessionPage,
  WorkoutSessionPageV2,
} from './pages';

function AuthenticatedApp() {
  return (
    <AppShell>
      <Routes>
        <Route path="/today" element={<TodayPage />} />
        <Route path="/training" element={<ProgramEditorPage />} />
        <Route path="/training/new" element={<ProgramCreationWizardPage />} />
        {/* v2 is routed alongside v1 rather than replacing it, so the two can
            be compared on real session data before v1 is retired. Ordered
            first so "v2" is not swallowed by the :sessionId param. */}
        <Route path="/workout/v2/:sessionId" element={<WorkoutSessionPageV2 />} />
        <Route path="/workout/:sessionId" element={<WorkoutSessionPage />} />
        <Route path="/history" element={<ExerciseHistoryPage />} />
        <Route path="/history/:exerciseId" element={<ExerciseHistoryPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Routes>
    </AppShell>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route path="/sign-up/*" element={<SignUpPage />} />
      <Route
        path="/*"
        element={
          <>
            <SignedIn>
              <AuthenticatedApp />
            </SignedIn>
            <SignedOut>
              <RedirectToSignIn />
            </SignedOut>
          </>
        }
      />
    </Routes>
  );
}
