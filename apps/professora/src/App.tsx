import { useOnboardingStore } from '@/store'
import { isSupabaseAuthEnabled } from '@/services/supabase/config'
import Onboarding from '@/screens/Onboarding'
import AppShell from '@/components/layout/AppShell'
import AuthGate from '@/screens/AuthGate'

export default function App() {
  const { completed } = useOnboardingStore()
  const app = completed ? <AppShell /> : <Onboarding />

  if (isSupabaseAuthEnabled()) {
    return <AuthGate>{app}</AuthGate>
  }

  return app
}
