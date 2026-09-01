import { auth } from '@/../auth';
import { getDashboardInitialData } from '@/shared/lib/server/dashboard-initial-data';
import { DashboardInitialDataProvider } from './dashboard-initial-data-provider';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const initialData = session?.user?.id
    ? await getDashboardInitialData(
        session.user.id,
        session.user.activeCharacterId ?? null,
      ).catch(() => null)
    : null;

  return (
    <DashboardInitialDataProvider data={initialData}>
      {children}
    </DashboardInitialDataProvider>
  );
}
