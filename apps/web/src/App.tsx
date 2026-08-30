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
  WorkoutSessionPageV2,
  TrainingPageV2,
} from './pages';

function AuthenticatedApp() {
  return (
    <AppShell>
      <Routes>
        <Route path="/today" element={<TodayPage />} />
        <Route path="/training" element={<TrainingPageV2 />} />
        {/* The three-tab editor, still reachable while stories 79-81 build
            the pushed screens the overview replaces it with. */}
        <Route path="/training/manage" element={<ProgramEditorPage />} />
        <Route path="/training/new" element={<ProgramCreationWizardPage />} />
        {/* The canonical workout route renders v2. Versioning lives in the
            file names, not the URL — v1 stays in the tree, unrouted, until
            these changes are approved and it can be deleted. */}
        <Route path="/workout/:sessionId" element={<WorkoutSessionPageV2 />} />
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
