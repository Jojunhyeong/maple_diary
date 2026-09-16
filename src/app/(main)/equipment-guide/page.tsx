import { EquipmentGuide } from '@/widgets/equipment-guide/equipment-guide';
import { EQUIPMENT_GUIDE_ENABLED } from '@/shared/lib/equipment-guide-feature';
import { notFound } from 'next/navigation';

export default function EquipmentGuidePage() {
  if (!EQUIPMENT_GUIDE_ENABLED) notFound();
  return <EquipmentGuide />;
}
