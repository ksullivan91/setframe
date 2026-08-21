import { Navigate, Route, Routes } from 'react-router-dom';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { AppShell } from './components/AppShell';
import {
  SignInPage,
  SignUpPage,
  TodayPage,
  ProgramEditorPage,
  ExerciseHistoryPage,
  ProgressPage,
  SettingsPage,
  WorkoutSessionPage,
} from './pages';

function AuthenticatedApp() {
  return (
    <AppShell>
      <Routes>
        <Route path="/today" element={<TodayPage />} />
        <Route path="/training" element={<ProgramEditorPage />} />
        <Route path="/workout/:sessionId" element={<WorkoutSessionPage />} />
        <Route path="/history" element={<ExerciseHistoryPage />} />
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
