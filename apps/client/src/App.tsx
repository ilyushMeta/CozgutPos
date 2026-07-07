import { useEffect, useState } from 'react';
import { useAuthStore } from './store/auth';
import { fetchSettings } from './api';
import { LoginPage } from './pages/LoginPage';
import { BackOfficeShell } from './pages/BackOfficeShell';
import { PosShell } from './pages/PosShell';
import { FirstRunWizard } from './pages/FirstRunWizard';

export function App() {
  const user = useAuthStore((s) => s.user);
  const [firstRunDone, setFirstRunDone] = useState<boolean | null>(null);

  useEffect(() => {
    fetchSettings()
      .then((s) => setFirstRunDone(s['app.firstRunDone'] === 'true'))
      .catch(() => setFirstRunDone(true)); // if unreachable, don't block login
  }, []);

  if (firstRunDone === null) return null;
  if (!firstRunDone) return <FirstRunWizard onDone={() => setFirstRunDone(true)} />;
  if (!user) return <LoginPage />;

  // Route by role (SPEC §5.1): ADMIN → back-office, CASHIER → POS.
  return user.role === 'ADMIN' ? <BackOfficeShell /> : <PosShell />;
}
