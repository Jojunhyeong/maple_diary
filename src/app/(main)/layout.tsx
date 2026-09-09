import { AppShell } from '@/shared/ui/AppShell';
import { LazyMainModals } from '@/shared/ui/LazyMainModals';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}<LazyMainModals /></AppShell>;
}
