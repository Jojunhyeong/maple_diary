import { BottomNav } from '@/shared/ui/BottomNav';
import { RecordModal } from '@/shared/ui/RecordModal';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen pb-[72px]">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col">
        {children}
      </div>
      <BottomNav />
      <RecordModal />
    </div>
  );
}
