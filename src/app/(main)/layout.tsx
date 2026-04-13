import { BottomNav } from '@/shared/ui/BottomNav';
import { CharacterSidebarSlot } from '@/shared/ui/CharacterSidebarSlot';
import { RecordModal } from '@/shared/ui/RecordModal';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col pb-[104px]">
      <div className="relative flex-1">
        <CharacterSidebarSlot />
        <div className="mx-auto flex w-full max-w-[400px] flex-col">
          {children}
        </div>
      </div>
      <div className="fixed bottom-0 left-1/2 z-50 w-[calc(100%-2rem)] max-w-[368px] -translate-x-1/2 pb-[max(12px,env(safe-area-inset-bottom))]">
        <BottomNav />
      </div>
      <RecordModal />
    </div>
  );
}
