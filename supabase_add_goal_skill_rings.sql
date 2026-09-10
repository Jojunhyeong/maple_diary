-- Add commonly traded Lv.4 special skill rings to the goal equipment catalog.

insert into public.equipment_catalog (
  slug,
  name,
  slot,
  part,
  job_group,
  wiki_title,
  level,
  icon_url,
  source_url
) values
  (
    'ring-of-restraint-lv4',
    '리스트레인트 링 Lv.4',
    '반지',
    '반지',
    null,
    'Ring of Restraint',
    110,
    'https://media.maplestorywiki.net/yetidb/Eqp_Ring_of_Restraint.png',
    'https://maplestorywiki.net/w/Ring_of_Restraint'
  ),
  (
    'continuous-ring-lv4',
    '컨티뉴어스 링 Lv.4',
    '반지',
    '반지',
    null,
    'Continuous Ring',
    110,
    'https://media.maplestorywiki.net/yetidb/Eqp_Continuous_Ring.png',
    'https://maplestorywiki.net/w/Continuous_Ring'
  )
on conflict (slug) do update set
  name = excluded.name,
  slot = excluded.slot,
  part = excluded.part,
  job_group = excluded.job_group,
  wiki_title = excluded.wiki_title,
  level = excluded.level,
  icon_url = excluded.icon_url,
  source_url = excluded.source_url,
  updated_at = now();

notify pgrst, 'reload schema';
