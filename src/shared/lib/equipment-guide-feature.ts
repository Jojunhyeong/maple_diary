export const EQUIPMENT_GUIDE_ENABLED =
  process.env.NODE_ENV === 'development'
  || process.env.NEXT_PUBLIC_EQUIPMENT_GUIDE_ENABLED === 'true';
