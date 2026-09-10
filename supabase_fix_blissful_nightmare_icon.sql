-- Fix the goal catalog image metadata for 황홀한 악몽.

update public.equipment_catalog
set
  wiki_title = 'Blissful Nightmare',
  icon_url = 'https://media.maplestorywiki.net/yetidb/Eqp_Blissful_Nightmare.png',
  source_url = 'https://maplestorywiki.net/w/Blissful_Nightmare',
  updated_at = now()
where slug = 'Entrancing-Nightmare';

notify pgrst, 'reload schema';
