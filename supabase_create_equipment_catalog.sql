-- Equipment catalog for goal item search
-- Seeded from MapleStory Network Discover item pages and community icon patterns.

create table if not exists public.equipment_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  slot text not null,
  part text not null,
  job_group text,
  wiki_title text,
  level int,
  icon_url text,
  source_url text,
  source text not null default 'maplestory_network',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.equipment_catalog
  add column if not exists job_group text;
alter table public.equipment_catalog
  add column if not exists wiki_title text;

create index if not exists idx_equipment_catalog_slot on public.equipment_catalog (slot);
create index if not exists idx_equipment_catalog_part on public.equipment_catalog (part);
create index if not exists idx_equipment_catalog_job_group on public.equipment_catalog (job_group);
create index if not exists idx_equipment_catalog_name on public.equipment_catalog (name);

-- Keep only the rows defined below so the catalog always matches this seed file.
delete from public.equipment_catalog;

insert into public.equipment_catalog (slug, name, slot, part, job_group, level, icon_url, source_url) values
  ('commanding-force-earring', '커맨더 포스 이어링', '귀고리', '귀고리', null, 200, null, null),
  ('dea-sidus-earring', '데아 시두스 이어링', '귀고리', '귀고리', null, 130, null, null),
  ('ocean-glow-earrings', '오션 글로우 이어링', '귀고리', '귀고리', null, 150, null, null),
  ('meister-earring', '마이스터 이어링', '귀고리', '귀고리', null, 140, null, null),
  ('estella-earrings', '에스텔라 이어링', '귀고리', '귀고리', null, 160, null, null),
  ('silver-blossom-ring', '실버 블로썸 링', '반지', '반지', null, 120, null, null),
  ('meister-ring', '마이스터 링', '반지', '반지', null, 140, null, null),
  ('guardian-angel-ring', '가디언 엔젤 링', '반지', '반지', null, 160, null, null),
  ('endless-terror', '거대한 공포', '반지', '반지', null, 200, null, null),
  ('whisper-of-the-source', '근원의 속삭임', '반지', '반지', null, 250, 'https://media.maplestorywiki.net/yetidb/Eqp_Whisper_of_the_Source.png', null),
  ('Entrancing-Nightmare', '황홀한 악몽', '반지', '반지', null, 250, null, null),
  

  ('mechanator-pendant', '메커네이터 펜던트', '펜던트', '펜던트', null, 120, null, null),
  ('dominator-pendant', '도미네이터 펜던트', '펜던트', '펜던트', null, 140, null, null),
  ('daybreak-pendant', '데이브레이크 펜던트', '펜던트', '펜던트', null, 140, null, null),
  ('oath-of-death', '죽음의 맹세', '펜던트', '펜던트', null, 250, 'https://media.maplestorywiki.net/yetidb/Eqp_Oath_of_Death.png', null),

  ('tyrant-belt', '타일런트 벨트', '벨트', '벨트', null, 150, null, null),
  ('enraged-zakum-belt', '분노한 자쿰의 벨트', '벨트', '벨트', null, 150, null, null),
  ('golden-clover-belt', '골든 클로버 벨트', '벨트', '벨트', null, 140, null, null),
  ('dreamy-belt', '몽환의 벨트', '벨트', '벨트', null, 200, null, null),

  ('twilight-mark', '트와일라이트 마크', '얼굴장식', '얼굴장식', null, 140, null, null),
  ('berserked', '루즈 컨트롤 머신 마크', '얼굴장식', '얼굴장식', null, 160, 'https://media.maplestorywiki.net/yetidb/Eqp_Berserked.png', null),
  ('original-sin-of-pride', '오만의 원죄', '얼굴장식', '얼굴장식', null, 250, 'https://media.maplestorywiki.net/yetidb/Eqp_Original_Sin_of_Pride.png', null),
  ('black-bean-mark', '블랙빈 마크', '눈장식', '눈장식', null, 135, null, null),
  ('papulatus-mark', '파풀라투스 마크', '눈장식', '눈장식', null, 145, null, null),
  ('magic-eyepatch', '마력이 깃든 안대', '눈장식', '눈장식', null, 160, null, null),
  ('genesis-badge', '창세의 뱃지', '뱃지', '뱃지', null, 200, null, null),
  ('seven-days-badge', '칠요의 뱃지', '뱃지', '뱃지', null, 100, null, null),
  ('immortal-legacy', '불멸의 유산', '훈장', '훈장', null, 250, null, null),
  ('pink-holy-cup', '핑크빛 성배', '포켓 아이템', '포켓 아이템', null, 140, null, null),
  ('cursed-red-spellbook', '저주받은 적의 마도서', '포켓 아이템', '포켓 아이템', null, 160, null, null),
  ('cursed-blue-spellbook', '저주받은 청의 마도서', '포켓 아이템', '포켓 아이템', null, 160, null, null),
  ('cursed-green-spellbook', '저주받은 녹의 마도서', '포켓 아이템', '포켓 아이템', null, 160, null, null),
  ('cursed-yellow-spellbook', '저주받은 황의 마도서', '포켓 아이템', '포켓 아이템', null, 160, null, null),
  ('Total-Control', '컴플리트 언더컨트롤', '기계심장', '기계심장', null, 200, null, null),

  ('eternal-knight-helm', '에테르넬 나이트 헬름', '모자', '모자', 'warrior', 250, null, null),
  ('eternal-knight-armor', '에테르넬 나이트 아머', '상의', '상의', 'warrior', 250, null, null),
  ('eternal-knight-pants', '에테르넬 나이트 팬츠', '하의', '하의', 'warrior', 250, null, null),
  ('eternal-knight-shoes', '에테르넬 나이트 슈즈', '신발', '신발', 'warrior', 250, null, null),
  ('eternal-knight-gloves', '에테르넬 나이트 글러브', '장갑', '장갑', 'warrior', 250, null, null),
  ('eternal-knight-cape', '에테르넬 나이트 케이프', '망토', '망토', 'warrior', 250, null, null),
  ('eternal-knight-shoulder', '에테르넬 나이트 숄더', '어깨장식', '어깨장식', 'warrior', 250, null, null),
  ('eternal-mage-hat', '에테르넬 메이지 햇', '모자', '모자', 'magician', 250, null, null),
  ('eternal-mage-robe', '에테르넬 메이지 로브', '상의', '상의', 'magician', 250, null, null),
  ('eternal-mage-pants', '에테르넬 메이지 팬츠', '하의', '하의', 'magician', 250, null, null),
  ('eternal-mage-shoes', '에테르넬 메이지 슈즈', '신발', '신발', 'magician', 250, null, null),
  ('eternal-mage-gloves', '에테르넬 메이지 글러브', '장갑', '장갑', 'magician', 250, null, null),
  ('eternal-mage-cape', '에테르넬 메이지 케이프', '망토', '망토', 'magician', 250, null, null),
  ('eternal-mage-shoulder', '에테르넬 메이지 숄더', '어깨장식', '어깨장식', 'magician', 250, null, null),
  ('eternal-archer-hat', '에테르넬 아처 햇', '모자', '모자', 'bowman', 250, null, null),
  ('eternal-archer-hood', '에테르넬 아처 후드', '상의', '상의', 'bowman', 250, null, null),
  ('eternal-archer-pants', '에테르넬 아처 팬츠', '하의', '하의', 'bowman', 250, null, null),
  ('eternal-archer-shoes', '에테르넬 아처 슈즈', '신발', '신발', 'bowman', 250, null, null),
  ('eternal-archer-gloves', '에테르넬 아처 글러브', '장갑', '장갑', 'bowman', 250, null, null),
  ('eternal-archer-cape', '에테르넬 아처 케이프', '망토', '망토', 'bowman', 250, null, null),
  ('eternal-archer-shoulder', '에테르넬 아처 숄더', '어깨장식', '어깨장식', 'bowman', 250, null, null),
  ('eternal-thief-bandana', '에테르넬 시프 반다나', '모자', '모자', 'thief', 250, null, null),
  ('eternal-thief-shirt', '에테르넬 시프 셔츠', '상의', '상의', 'thief', 250, null, null),
  ('eternal-thief-pants', '에테르넬 시프 팬츠', '하의', '하의', 'thief', 250, null, null),
  ('eternal-thief-shoes', '에테르넬 시프 슈즈', '신발', '신발', 'thief', 250, null, null),
  ('eternal-thief-gloves', '에테르넬 시프 글러브', '장갑', '장갑', 'thief', 250, null, null),
  ('eternal-thief-cape', '에테르넬 시프 케이프', '망토', '망토', 'thief', 250, null, null),
  ('eternal-thief-shoulder', '에테르넬 시프 숄더', '어깨장식', '어깨장식', 'thief', 250, null, null),
  ('eternal-pirate-hat', '에테르넬 파이럿 햇', '모자', '모자', 'pirate', 250, null, null),
  ('eternal-pirate-coat', '에테르넬 파이럿 코트', '상의', '상의', 'pirate', 250, null, null),
  ('eternal-pirate-pants', '에테르넬 파이럿 팬츠', '하의', '하의', 'pirate', 250, null, null),
  ('eternal-pirate-shoes', '에테르넬 파이럿 슈즈', '신발', '신발', 'pirate', 250, null, null),
  ('eternal-pirate-gloves', '에테르넬 파이럿 글러브', '장갑', '장갑', 'pirate', 250, null, null),
  ('eternal-pirate-cape', '에테르넬 파이럿 케이프', '망토', '망토', 'pirate', 250, null, null),
  ('eternal-pirate-shoulder', '에테르넬 파이럿 숄더', '어깨장식', '어깨장식', 'pirate', 250, null, null),

  ('arcane-umbra-knight-hat', '아케인셰이드 나이트 헬름', '모자', '모자', 'warrior', 200, null, null),
  ('arcane-umbra-knight-suit', '아케인셰이드 나이트 수트', '상의', '상의', 'warrior', 200, null, null),
  ('arcane-umbra-knight-shoes', '아케인셰이드 나이트 슈즈', '신발', '신발', 'warrior', 200, null, null),
  ('arcane-umbra-knight-gloves', '아케인셰이드 나이트 글러브', '장갑', '장갑', 'warrior', 200, null, null),
  ('arcane-umbra-knight-cape', '아케인셰이드 나이트 케이프', '망토', '망토', 'warrior', 200, null, null),
  ('arcane-umbra-knight-shoulder', '아케인셰이드 나이트 숄더', '어깨장식', '어깨장식', 'warrior', 200, null, null),
  ('arcane-umbra-mage-hat', '아케인셰이드 메이지 햇', '모자', '모자', 'magician', 200, null, null),
  ('arcane-umbra-mage-suit', '아케인셰이드 메이지 수트', '상의', '상의', 'magician', 200, null, null),
  ('arcane-umbra-mage-shoes', '아케인셰이드 메이지 슈즈', '신발', '신발', 'magician', 200, null, null),
  ('arcane-umbra-mage-gloves', '아케인셰이드 메이지 글러브', '장갑', '장갑', 'magician', 200, null, null),
  ('arcane-umbra-mage-cape', '아케인셰이드 메이지 케이프', '망토', '망토', 'magician', 200, null, null),
  ('arcane-umbra-mage-shoulder', '아케인셰이드 메이지 숄더', '어깨장식', '어깨장식', 'magician', 200, null, null),
  ('arcane-umbra-archer-hat', '아케인셰이드 아처 햇', '모자', '모자', 'bowman', 200, null, null),
  ('arcane-umbra-archer-suit', '아케인셰이드 아처 수트', '상의', '상의', 'bowman', 200, null, null),
  ('arcane-umbra-archer-shoes', '아케인셰이드 아처 슈즈', '신발', '신발', 'bowman', 200, null, null),
  ('arcane-umbra-archer-gloves', '아케인셰이드 아처 글러브', '장갑', '장갑', 'bowman', 200, null, null),
  ('arcane-umbra-archer-cape', '아케인셰이드 아처 케이프', '망토', '망토', 'bowman', 200, null, null),
  ('arcane-umbra-archer-shoulder', '아케인셰이드 아처 숄더', '어깨장식', '어깨장식', 'bowman', 200, null, null),
  ('arcane-umbra-thief-hat', '아케인셰이드 시프 반다나', '모자', '모자', 'thief', 200, null, null),
  ('arcane-umbra-thief-suit', '아케인셰이드 시프 수트', '상의', '상의', 'thief', 200, null, null),
  ('arcane-umbra-thief-shoes', '아케인셰이드 시프 슈즈', '신발', '신발', 'thief', 200, null, null),
  ('arcane-umbra-thief-gloves', '아케인셰이드 시프 글러브', '장갑', '장갑', 'thief', 200, null, null),
  ('arcane-umbra-thief-cape', '아케인셰이드 시프 케이프', '망토', '망토', 'thief', 200, null, null),
  ('arcane-umbra-thief-shoulder', '아케인셰이드 시프 숄더', '어깨장식', '어깨장식', 'thief', 200, null, null),
  ('arcane-umbra-pirate-hat', '아케인셰이드 파이럿 햇', '모자', '모자', 'pirate', 200, null, null),
  ('arcane-umbra-pirate-suit', '아케인셰이드 파이럿 수트', '상의', '상의', 'pirate', 200, null, null),
  ('arcane-umbra-pirate-shoes', '아케인셰이드 파이럿 슈즈', '신발', '신발', 'pirate', 200, null, null),
  ('arcane-umbra-pirate-gloves', '아케인셰이드 파이럿 글러브', '장갑', '장갑', 'pirate', 200, null, null),
  ('arcane-umbra-pirate-cape', '아케인셰이드 파이럿 케이프', '망토', '망토', 'pirate', 200, null, null),
  ('arcane-umbra-pirate-shoulder', '아케인셰이드 파이럿 숄더', '어깨장식', '어깨장식', 'pirate', 200, null, null),

  ('absolab-knight-helm', '앱솔랩스 나이트 헬름', '모자', '모자', 'warrior', 160, null, null),
  ('absolab-knight-suit', '앱솔랩스 나이트 수트', '상의', '상의', 'warrior', 160, null, null),
  ('absolab-knight-shoes', '앱솔랩스 나이트 슈즈', '신발', '신발', 'warrior', 160, null, null),
  ('absolab-knight-gloves', '앱솔랩스 나이트 글러브', '장갑', '장갑', 'warrior', 160, null, null),
  ('absolab-knight-cape', '앱솔랩스 나이트 케이프', '망토', '망토', 'warrior', 160, null, null),
  ('absolab-knight-shoulder', '앱솔랩스 나이트 숄더', '어깨장식', '어깨장식', 'warrior', 160, null, null),
  ('absolab-mage-crown', '앱솔랩스 메이지 크라운', '모자', '모자', 'magician', 160, null, null),
  ('absolab-mage-suit', '앱솔랩스 메이지 수트', '상의', '상의', 'magician', 160, null, null),
  ('absolab-mage-shoes', '앱솔랩스 메이지 슈즈', '신발', '신발', 'magician', 160, null, null),
  ('absolab-mage-gloves', '앱솔랩스 메이지 글러브', '장갑', '장갑', 'magician', 160, null, null),
  ('absolab-mage-cape', '앱솔랩스 메이지 케이프', '망토', '망토', 'magician', 160, null, null),
  ('absolab-mage-shoulder', '앱솔랩스 메이지 숄더', '어깨장식', '어깨장식', 'magician', 160, null, null),
  ('absolab-archer-hood', '앱솔랩스 아처 후드', '모자', '모자', 'bowman', 160, null, null),
  ('absolab-archer-suit', '앱솔랩스 아처 수트', '상의', '상의', 'bowman', 160, null, null),
  ('absolab-archer-shoes', '앱솔랩스 아처 슈즈', '신발', '신발', 'bowman', 160, null, null),
  ('absolab-archer-gloves', '앱솔랩스 아처 글러브', '장갑', '장갑', 'bowman', 160, null, null),
  ('absolab-archer-cape', '앱솔랩스 아처 케이프', '망토', '망토', 'bowman', 160, null, null),
  ('absolab-archer-shoulder', '앱솔랩스 아처 숄더', '어깨장식', '어깨장식', 'bowman', 160, null, null),
  ('absolab-bandit-cap', '앱솔랩스 시프 캡', '모자', '모자', 'thief', 160, null, null),
  ('absolab-bandit-suit', '앱솔랩스 시프 수트', '상의', '상의', 'thief', 160, null, null),
  ('absolab-bandit-shoes', '앱솔랩스 시프 슈즈', '신발', '신발', 'thief', 160, null, null),
  ('absolab-bandit-gloves', '앱솔랩스 시프 글러브', '장갑', '장갑', 'thief', 160, null, null),
  ('absolab-bandit-cape', '앱솔랩스 시프 케이프', '망토', '망토', 'thief', 160, null, null),
  ('absolab-bandit-shoulder', '앱솔랩스 시프 숄더', '어깨장식', '어깨장식', 'thief', 160, null, null),
  ('absolab-pirate-fedora', '앱솔랩스 파이럿 페도라', '모자', '모자', 'pirate', 160, null, null),
  ('absolab-pirate-suit', '앱솔랩스 파이럿 수트', '상의', '상의', 'pirate', 160, null, null),
  ('absolab-pirate-shoes', '앱솔랩스 파이럿 슈즈', '신발', '신발', 'pirate', 160, null, null),
  ('absolab-pirate-gloves', '앱솔랩스 파이럿 글러브', '장갑', '장갑', 'pirate', 160, null, null),
  ('absolab-pirate-cape', '앱솔랩스 파이럿 케이프', '망토', '망토', 'pirate', 160, null, null),
  ('absolab-pirate-shoulder', '앱솔랩스 파이럿 숄더', '어깨장식', '어깨장식', 'pirate', 160, null, null),

  ('royal-warrior-helm', '하이네스 워리어헬름', '모자', '모자', 'warrior', 150, null, null),
  ('eagle-eye-warrior-armor', '이글아이 워리어아머', '상의', '상의', 'warrior', 150, null, null),
  ('trixter-warrior-pants', '트릭스터 워리어팬츠', '하의', '하의', 'warrior', 150, null, null),
  ('royal-dunwitch-hat', '하이네스 던위치햇', '모자', '모자', 'magician', 150, null, null),
  ('eagle-eye-dunwitch-robe', '이글아이 던위치로브', '상의', '상의', 'magician', 150, null, null),
  ('trixter-dunwitch-pants', '트릭스터 던위치팬츠', '하의', '하의', 'magician', 150, null, null),
  ('royal-ranger-beret', '하이네스 레인져베레', '모자', '모자', 'bowman', 150, null, null),
  ('eagle-eye-ranger-cowl', '이글아이 레인져후드', '상의', '상의', 'bowman', 150, null, null),
  ('trixter-ranger-pants', '트릭스터 레인져팬츠', '하의', '하의', 'bowman', 150, null, null),
  ('royal-assassin-hood', '하이네스 어새신보닛', '모자', '모자', 'thief', 150, null, null),
  ('eagle-eye-assassin-shirt', '이글아이 어새신셔츠', '상의', '상의', 'thief', 150, null, null),
  ('trixter-assassin-pants', '트릭스터 어새신팬츠', '하의', '하의', 'thief', 150, null, null),
  ('royal-wanderer-hat', '하이네스 원더러햇', '모자', '모자', 'pirate', 150, null, null),
  ('eagle-eye-wanderer-coat', '이글아이 원더러코트', '상의', '상의', 'pirate', 150, null, null),
  ('trixter-wanderer-pants', '트릭스터 원더러팬츠', '하의', '하의', 'pirate', 150, null, null),

  ('meister-shoulder', '마이스터 숄더', '어깨장식', '어깨장식', null, 140, null, null),

  ('absolab-weapon', '앱솔랩스 무기', '무기', '무기', null, 160, null, null),
  ('fafnir-weapon', '파프니르 무기', '무기', '무기', null, 150, null, null),
  ('arcane-umbra-weapon', '아케인셰이드 무기', '무기', '무기', null, 200, null, null)
on conflict (slug) do update set
  name = excluded.name,
  slot = excluded.slot,
  part = excluded.part,
  job_group = excluded.job_group,
  level = excluded.level,
  icon_url = excluded.icon_url,
  source_url = excluded.source_url,
  source = excluded.source,
  updated_at = now();

update public.equipment_catalog set wiki_title = 'Great Dread' where slug = 'endless-terror';
update public.equipment_catalog set wiki_title = 'Whisper of the Source' where slug = 'whisper-of-the-source';
update public.equipment_catalog set wiki_title = 'Mechanator Pendant' where slug = 'mechanator-pendant';
update public.equipment_catalog set wiki_title = 'Dominator Pendant' where slug = 'dominator-pendant';
update public.equipment_catalog set wiki_title = 'Daybreak Pendant' where slug = 'daybreak-pendant';
update public.equipment_catalog set wiki_title = 'Source of Suffering' where slug = 'source-of-suffering';
update public.equipment_catalog set wiki_title = 'Oath of Death' where slug = 'oath-of-death';
update public.equipment_catalog set wiki_title = 'Twilight Mark' where slug = 'twilight-mark';
update public.equipment_catalog set wiki_title = 'Lose Control Machine Mark' where slug = 'lose-control-machine-mark';
update public.equipment_catalog set wiki_title = 'Original Sin of Pride' where slug = 'original-sin-of-pride';
update public.equipment_catalog set wiki_title = 'Black Bean Mark' where slug = 'black-bean-mark';
update public.equipment_catalog set wiki_title = 'Papulatus Mark' where slug = 'papulatus-mark';
update public.equipment_catalog set wiki_title = 'Magic Eyepatch' where slug = 'magic-eyepatch';
update public.equipment_catalog set wiki_title = 'Genesis Badge' where slug = 'genesis-badge';
update public.equipment_catalog set wiki_title = 'Seven Days Badge' where slug = 'seven-days-badge';
update public.equipment_catalog set wiki_title = 'Immortal Legacy' where slug = 'immortal-legacy';
update public.equipment_catalog set wiki_title = 'Pink Holy Cup' where slug = 'pink-holy-cup';
update public.equipment_catalog set wiki_title = 'Cursed Red Spellbook' where slug = 'cursed-red-spellbook';
update public.equipment_catalog set wiki_title = 'Cursed Blue Spellbook' where slug = 'cursed-blue-spellbook';
update public.equipment_catalog set wiki_title = 'Cursed Green Spellbook' where slug = 'cursed-green-spellbook';
update public.equipment_catalog set wiki_title = 'Cursed Yellow Spellbook' where slug = 'cursed-yellow-spellbook';
update public.equipment_catalog set wiki_title = 'Complete Under Control' where slug = 'complete-under-control';
update public.equipment_catalog set wiki_title = 'Sacred Rosary' where slug = 'sacred-rosary';
update public.equipment_catalog set wiki_title = 'Mitra''s Rage: Warrior', icon_url = 'https://media.maplestorywiki.net/yetidb/Eqp_Mitra''s_Rage_Warrior.png' where slug = 'mitras-rage-warrior';
update public.equipment_catalog set wiki_title = 'Metallic Blue Book (Epode)', icon_url = 'https://media.maplestorywiki.net/yetidb/Eqp_Metallic_Blue_Book_(Epode).png' where slug = 'metallic-blue-book-epode';
update public.equipment_catalog set wiki_title = 'White Gold Book (Epode)', icon_url = 'https://media.maplestorywiki.net/yetidb/Eqp_White_Gold_Book_(Epode).png' where slug = 'White-Gold-Book-Epode';
update public.equipment_catalog set wiki_title = 'Ornament' where slug = 'lara-ornament';
update public.equipment_catalog set wiki_title = 'Simple Four-Jade Ornament' where slug = 'lara-simple-four-jade-ornament';
update public.equipment_catalog set wiki_title = 'Subtle Four-Jade Ornament' where slug = 'lara-subtle-four-jade-ornament';
update public.equipment_catalog set wiki_title = 'Flashy Four-Jade Ornament' where slug = 'lara-flashy-four-jade-ornament';
update public.equipment_catalog set wiki_title = 'Radiant Four-Jade Ornament' where slug = 'lara-radiant-four-jade-ornament';
update public.equipment_catalog set wiki_title = 'Frozen Four-Jade Ornament' where slug = 'lara-frozen-four-jade-ornament';
update public.equipment_catalog set wiki_title = 'Onyx Maple Four-Jade Ornament' where slug = 'lara-onyx-maple-four-jade-ornament';
update public.equipment_catalog set wiki_title = 'Evolving Four-Jade Ornament' where slug = 'lara-evolving-four-jade-ornament';
update public.equipment_catalog set wiki_title = 'Princess No''s Immortal Four-Jade Ornament' where slug = 'lara-princess-nos-immortal-four-jade-ornament';
update public.equipment_catalog set wiki_title = 'Imugi Gem' where slug = 'ren-imugi-gem';
update public.equipment_catalog set wiki_title = 'Green Imugi Gem' where slug = 'ren-green-imugi-gem';
update public.equipment_catalog set wiki_title = 'Cerulean Imugi Gem' where slug = 'ren-cerulean-imugi-gem';
update public.equipment_catalog set wiki_title = 'Crimson Imugi Gem' where slug = 'ren-crimson-imugi-gem';
update public.equipment_catalog set wiki_title = 'Violet Imugi Gem' where slug = 'ren-violet-imugi-gem';
update public.equipment_catalog set wiki_title = 'Evolving Violet Imugi Gem' where slug = 'ren-evolving-violet-imugi-gem';
update public.equipment_catalog set wiki_title = 'Onyx Imugi Gem' where slug = 'ren-onyx-imugi-gem';
update public.equipment_catalog set wiki_title = 'Frozen Imugi Gem' where slug = 'ren-frozen-imugi-gem';
update public.equipment_catalog set wiki_title = 'Princess No''s Imugi Gem' where slug = 'ren-princess-nos-imugi-gem';
update public.equipment_catalog set wiki_title = 'Hex Seeker' where slug = 'khali-hex-seeker';
update public.equipment_catalog set wiki_title = 'Plain Hex Seeker' where slug = 'khali-plain-hex-seeker';
update public.equipment_catalog set wiki_title = 'Bright Hex Seeker' where slug = 'khali-bright-hex-seeker';
update public.equipment_catalog set wiki_title = 'Brilliant Hex Seeker' where slug = 'khali-brilliant-hex-seeker';
update public.equipment_catalog set wiki_title = 'Infinite Hex Seeker' where slug = 'khali-infinite-hex-seeker';
update public.equipment_catalog set wiki_title = 'Evolving Infinite Hex Seeker' where slug = 'khali-evolving-infinite-hex-seeker';
update public.equipment_catalog set wiki_title = 'Frozen Infinite Hex Seeker' where slug = 'khali-frozen-infinite-hex-seeker';
update public.equipment_catalog set wiki_title = 'Onyx Maple Infinite Hex Seeker' where slug = 'khali-onyx-maple-infinite-hex-seeker';
update public.equipment_catalog set wiki_title = 'Princess No''s Immortal Hex Seeker' where slug = 'khali-princess-nos-immortal-hex-seeker';
update public.equipment_catalog set name = '에테르넬 나이트 헬름', wiki_title = 'Eternal Knight Helm' where slug = 'eternal-knight-helm';
update public.equipment_catalog set name = '에테르넬 나이트 아머', wiki_title = 'Eternal Knight Armor' where slug = 'eternal-knight-armor';
update public.equipment_catalog set name = '에테르넬 나이트 팬츠', wiki_title = 'Eternal Knight Pants' where slug = 'eternal-knight-pants';
update public.equipment_catalog set name = '에테르넬 나이트 슈즈', wiki_title = 'Eternal Knight Shoes' where slug = 'eternal-knight-shoes';
update public.equipment_catalog set name = '에테르넬 나이트 글러브', wiki_title = 'Eternal Knight Gloves' where slug = 'eternal-knight-gloves';
update public.equipment_catalog set name = '에테르넬 나이트 케이프', wiki_title = 'Eternal Knight Cape' where slug = 'eternal-knight-cape';
update public.equipment_catalog set name = '에테르넬 나이트 숄더', wiki_title = 'Eternal Knight Shoulder' where slug = 'eternal-knight-shoulder';
update public.equipment_catalog set name = '에테르넬 메이지 햇', wiki_title = 'Eternal Mage Hat' where slug = 'eternal-mage-hat';
update public.equipment_catalog set name = '에테르넬 메이지 로브', wiki_title = 'Eternal Mage Robe' where slug = 'eternal-mage-robe';
update public.equipment_catalog set name = '에테르넬 메이지 팬츠', wiki_title = 'Eternal Mage Pants' where slug = 'eternal-mage-pants';
update public.equipment_catalog set name = '에테르넬 메이지 슈즈', wiki_title = 'Eternal Mage Shoes' where slug = 'eternal-mage-shoes';
update public.equipment_catalog set name = '에테르넬 메이지 글러브', wiki_title = 'Eternal Mage Gloves' where slug = 'eternal-mage-gloves';
update public.equipment_catalog set name = '에테르넬 메이지 케이프', wiki_title = 'Eternal Mage Cape' where slug = 'eternal-mage-cape';
update public.equipment_catalog set name = '에테르넬 메이지 숄더', wiki_title = 'Eternal Mage Shoulder' where slug = 'eternal-mage-shoulder';
update public.equipment_catalog set name = '에테르넬 아처 햇', wiki_title = 'Eternal Archer Hat' where slug = 'eternal-archer-hat';
update public.equipment_catalog set name = '에테르넬 아처 후드', wiki_title = 'Eternal Archer Hood' where slug = 'eternal-archer-hood';
update public.equipment_catalog set name = '에테르넬 아처 팬츠', wiki_title = 'Eternal Archer Pants' where slug = 'eternal-archer-pants';
update public.equipment_catalog set name = '에테르넬 아처 슈즈', wiki_title = 'Eternal Archer Shoes' where slug = 'eternal-archer-shoes';
update public.equipment_catalog set name = '에테르넬 아처 글러브', wiki_title = 'Eternal Archer Gloves' where slug = 'eternal-archer-gloves';
update public.equipment_catalog set name = '에테르넬 아처 케이프', wiki_title = 'Eternal Archer Cape' where slug = 'eternal-archer-cape';
update public.equipment_catalog set name = '에테르넬 아처 숄더', wiki_title = 'Eternal Archer Shoulder' where slug = 'eternal-archer-shoulder';
update public.equipment_catalog set name = '에테르넬 시프 반다나', wiki_title = 'Eternal Thief Bandana' where slug = 'eternal-thief-bandana';
update public.equipment_catalog set name = '에테르넬 시프 셔츠', wiki_title = 'Eternal Thief Shirt' where slug = 'eternal-thief-shirt';
update public.equipment_catalog set name = '에테르넬 시프 팬츠', wiki_title = 'Eternal Thief Pants' where slug = 'eternal-thief-pants';
update public.equipment_catalog set name = '에테르넬 시프 슈즈', wiki_title = 'Eternal Thief Shoes' where slug = 'eternal-thief-shoes';
update public.equipment_catalog set name = '에테르넬 시프 글러브', wiki_title = 'Eternal Thief Gloves' where slug = 'eternal-thief-gloves';
update public.equipment_catalog set name = '에테르넬 시프 케이프', wiki_title = 'Eternal Thief Cape' where slug = 'eternal-thief-cape';
update public.equipment_catalog set name = '에테르넬 시프 숄더', wiki_title = 'Eternal Thief Shoulder' where slug = 'eternal-thief-shoulder';
update public.equipment_catalog set name = '에테르넬 파이럿 햇', wiki_title = 'Eternal Pirate Hat' where slug = 'eternal-pirate-hat';
update public.equipment_catalog set name = '에테르넬 파이럿 코트', wiki_title = 'Eternal Pirate Coat' where slug = 'eternal-pirate-coat';
update public.equipment_catalog set name = '에테르넬 파이럿 팬츠', wiki_title = 'Eternal Pirate Pants' where slug = 'eternal-pirate-pants';
update public.equipment_catalog set name = '에테르넬 파이럿 슈즈', wiki_title = 'Eternal Pirate Shoes' where slug = 'eternal-pirate-shoes';
update public.equipment_catalog set name = '에테르넬 파이럿 글러브', wiki_title = 'Eternal Pirate Gloves' where slug = 'eternal-pirate-gloves';
update public.equipment_catalog set name = '에테르넬 파이럿 케이프', wiki_title = 'Eternal Pirate Cape' where slug = 'eternal-pirate-cape';
update public.equipment_catalog set name = '에테르넬 파이럿 숄더', wiki_title = 'Eternal Pirate Shoulder' where slug = 'eternal-pirate-shoulder';

update public.equipment_catalog set name = '아케인셰이드 나이트 헬름', wiki_title = 'Arcane Umbra Knight Hat' where slug = 'arcane-umbra-knight-hat';
update public.equipment_catalog set name = '아케인셰이드 나이트 수트', wiki_title = 'Arcane Umbra Knight Suit' where slug = 'arcane-umbra-knight-suit';
update public.equipment_catalog set name = '아케인셰이드 나이트 슈즈', wiki_title = 'Arcane Umbra Knight Shoes' where slug = 'arcane-umbra-knight-shoes';
update public.equipment_catalog set name = '아케인셰이드 나이트 글러브', wiki_title = 'Arcane Umbra Knight Gloves' where slug = 'arcane-umbra-knight-gloves';
update public.equipment_catalog set name = '아케인셰이드 나이트 케이프', wiki_title = 'Arcane Umbra Knight Cape' where slug = 'arcane-umbra-knight-cape';
update public.equipment_catalog set name = '아케인셰이드 나이트 숄더', wiki_title = 'Arcane Umbra Knight Shoulder' where slug = 'arcane-umbra-knight-shoulder';
update public.equipment_catalog set name = '아케인셰이드 메이지 햇', wiki_title = 'Arcane Umbra Mage Hat' where slug = 'arcane-umbra-mage-hat';
update public.equipment_catalog set name = '아케인셰이드 메이지 수트', wiki_title = 'Arcane Umbra Mage Suit' where slug = 'arcane-umbra-mage-suit';
update public.equipment_catalog set name = '아케인셰이드 메이지 슈즈', wiki_title = 'Arcane Umbra Mage Shoes' where slug = 'arcane-umbra-mage-shoes';
update public.equipment_catalog set name = '아케인셰이드 메이지 글러브', wiki_title = 'Arcane Umbra Mage Gloves' where slug = 'arcane-umbra-mage-gloves';
update public.equipment_catalog set name = '아케인셰이드 메이지 케이프', wiki_title = 'Arcane Umbra Mage Cape' where slug = 'arcane-umbra-mage-cape';
update public.equipment_catalog set name = '아케인셰이드 메이지 숄더', wiki_title = 'Arcane Umbra Mage Shoulder' where slug = 'arcane-umbra-mage-shoulder';
update public.equipment_catalog set name = '아케인셰이드 아처 햇', wiki_title = 'Arcane Umbra Archer Hat' where slug = 'arcane-umbra-archer-hat';
update public.equipment_catalog set name = '아케인셰이드 아처 수트', wiki_title = 'Arcane Umbra Archer Suit' where slug = 'arcane-umbra-archer-suit';
update public.equipment_catalog set name = '아케인셰이드 아처 슈즈', wiki_title = 'Arcane Umbra Archer Shoes' where slug = 'arcane-umbra-archer-shoes';
update public.equipment_catalog set name = '아케인셰이드 아처 글러브', wiki_title = 'Arcane Umbra Archer Gloves' where slug = 'arcane-umbra-archer-gloves';
update public.equipment_catalog set name = '아케인셰이드 아처 케이프', wiki_title = 'Arcane Umbra Archer Cape' where slug = 'arcane-umbra-archer-cape';
update public.equipment_catalog set name = '아케인셰이드 아처 숄더', wiki_title = 'Arcane Umbra Archer Shoulder' where slug = 'arcane-umbra-archer-shoulder';
update public.equipment_catalog set name = '아케인셰이드 시프 반다나', wiki_title = 'Arcane Umbra Thief Hat' where slug = 'arcane-umbra-thief-hat';
update public.equipment_catalog set name = '아케인셰이드 시프 수트', wiki_title = 'Arcane Umbra Thief Suit' where slug = 'arcane-umbra-thief-suit';
update public.equipment_catalog set name = '아케인셰이드 시프 슈즈', wiki_title = 'Arcane Umbra Thief Shoes' where slug = 'arcane-umbra-thief-shoes';
update public.equipment_catalog set name = '아케인셰이드 시프 글러브', wiki_title = 'Arcane Umbra Thief Gloves' where slug = 'arcane-umbra-thief-gloves';
update public.equipment_catalog set name = '아케인셰이드 시프 케이프', wiki_title = 'Arcane Umbra Thief Cape' where slug = 'arcane-umbra-thief-cape';
update public.equipment_catalog set name = '아케인셰이드 시프 숄더', wiki_title = 'Arcane Umbra Thief Shoulder' where slug = 'arcane-umbra-thief-shoulder';
update public.equipment_catalog set name = '아케인셰이드 파이럿 햇', wiki_title = 'Arcane Umbra Pirate Hat' where slug = 'arcane-umbra-pirate-hat';
update public.equipment_catalog set name = '아케인셰이드 파이럿 수트', wiki_title = 'Arcane Umbra Pirate Suit' where slug = 'arcane-umbra-pirate-suit';
update public.equipment_catalog set name = '아케인셰이드 파이럿 슈즈', wiki_title = 'Arcane Umbra Pirate Shoes' where slug = 'arcane-umbra-pirate-shoes';
update public.equipment_catalog set name = '아케인셰이드 파이럿 글러브', wiki_title = 'Arcane Umbra Pirate Gloves' where slug = 'arcane-umbra-pirate-gloves';
update public.equipment_catalog set name = '아케인셰이드 파이럿 케이프', wiki_title = 'Arcane Umbra Pirate Cape' where slug = 'arcane-umbra-pirate-cape';
update public.equipment_catalog set name = '아케인셰이드 파이럿 숄더', wiki_title = 'Arcane Umbra Pirate Shoulder' where slug = 'arcane-umbra-pirate-shoulder';

update public.equipment_catalog set name = '앱솔랩스 나이트 헬름', wiki_title = 'AbsoLab Knight Helm' where slug = 'absolab-knight-helm';
update public.equipment_catalog set name = '앱솔랩스 나이트 수트', wiki_title = 'AbsoLab Knight Suit' where slug = 'absolab-knight-suit';
update public.equipment_catalog set name = '앱솔랩스 나이트 슈즈', wiki_title = 'AbsoLab Knight Shoes' where slug = 'absolab-knight-shoes';
update public.equipment_catalog set name = '앱솔랩스 나이트 글러브', wiki_title = 'AbsoLab Knight Gloves' where slug = 'absolab-knight-gloves';
update public.equipment_catalog set name = '앱솔랩스 나이트 케이프', wiki_title = 'AbsoLab Knight Cape' where slug = 'absolab-knight-cape';
update public.equipment_catalog set name = '앱솔랩스 나이트 숄더', wiki_title = 'AbsoLab Knight Shoulder' where slug = 'absolab-knight-shoulder';
update public.equipment_catalog set name = '앱솔랩스 메이지 크라운', wiki_title = 'AbsoLab Mage Crown' where slug = 'absolab-mage-crown';
update public.equipment_catalog set name = '앱솔랩스 메이지 수트', wiki_title = 'AbsoLab Mage Suit' where slug = 'absolab-mage-suit';
update public.equipment_catalog set name = '앱솔랩스 메이지 슈즈', wiki_title = 'AbsoLab Mage Shoes' where slug = 'absolab-mage-shoes';
update public.equipment_catalog set name = '앱솔랩스 메이지 글러브', wiki_title = 'AbsoLab Mage Gloves' where slug = 'absolab-mage-gloves';
update public.equipment_catalog set name = '앱솔랩스 메이지 케이프', wiki_title = 'AbsoLab Mage Cape' where slug = 'absolab-mage-cape';
update public.equipment_catalog set name = '앱솔랩스 메이지 숄더', wiki_title = 'AbsoLab Mage Shoulder' where slug = 'absolab-mage-shoulder';
update public.equipment_catalog set name = '앱솔랩스 아처 후드', wiki_title = 'AbsoLab Archer Hood' where slug = 'absolab-archer-hood';
update public.equipment_catalog set name = '앱솔랩스 아처 수트', wiki_title = 'AbsoLab Archer Suit' where slug = 'absolab-archer-suit';
update public.equipment_catalog set name = '앱솔랩스 아처 슈즈', wiki_title = 'AbsoLab Archer Shoes' where slug = 'absolab-archer-shoes';
update public.equipment_catalog set name = '앱솔랩스 아처 글러브', wiki_title = 'AbsoLab Archer Gloves' where slug = 'absolab-archer-gloves';
update public.equipment_catalog set name = '앱솔랩스 아처 케이프', wiki_title = 'AbsoLab Archer Cape' where slug = 'absolab-archer-cape';
update public.equipment_catalog set name = '앱솔랩스 아처 숄더', wiki_title = 'AbsoLab Archer Shoulder' where slug = 'absolab-archer-shoulder';
update public.equipment_catalog set name = '앱솔랩스 시프 캡', wiki_title = 'AbsoLab Bandit Cap' where slug = 'absolab-bandit-cap';
update public.equipment_catalog set name = '앱솔랩스 시프 수트', wiki_title = 'AbsoLab Bandit Suit' where slug = 'absolab-bandit-suit';
update public.equipment_catalog set name = '앱솔랩스 시프 슈즈', wiki_title = 'AbsoLab Bandit Shoes' where slug = 'absolab-bandit-shoes';
update public.equipment_catalog set name = '앱솔랩스 시프 글러브', wiki_title = 'AbsoLab Bandit Gloves' where slug = 'absolab-bandit-gloves';
update public.equipment_catalog set name = '앱솔랩스 시프 케이프', wiki_title = 'AbsoLab Bandit Cape' where slug = 'absolab-bandit-cape';
update public.equipment_catalog set name = '앱솔랩스 시프 숄더', wiki_title = 'AbsoLab Bandit Shoulder' where slug = 'absolab-bandit-shoulder';
update public.equipment_catalog set name = '앱솔랩스 파이럿 페도라', wiki_title = 'AbsoLab Pirate Fedora' where slug = 'absolab-pirate-fedora';
update public.equipment_catalog set name = '앱솔랩스 파이럿 수트', wiki_title = 'AbsoLab Pirate Suit' where slug = 'absolab-pirate-suit';
update public.equipment_catalog set name = '앱솔랩스 파이럿 슈즈', wiki_title = 'AbsoLab Pirate Shoes' where slug = 'absolab-pirate-shoes';
update public.equipment_catalog set name = '앱솔랩스 파이럿 글러브', wiki_title = 'AbsoLab Pirate Gloves' where slug = 'absolab-pirate-gloves';
update public.equipment_catalog set name = '앱솔랩스 파이럿 케이프', wiki_title = 'AbsoLab Pirate Cape' where slug = 'absolab-pirate-cape';
update public.equipment_catalog set name = '앱솔랩스 파이럿 숄더', wiki_title = 'AbsoLab Pirate Shoulder' where slug = 'absolab-pirate-shoulder';

update public.equipment_catalog set name = '하이네스 워리어헬름', wiki_title = 'Royal Warrior Helm' where slug = 'royal-warrior-helm';
update public.equipment_catalog set name = '이글아이 워리어아머', wiki_title = 'Eagle Eye Warrior Armor' where slug = 'eagle-eye-warrior-armor';
update public.equipment_catalog set name = '트릭스터 워리어팬츠', wiki_title = 'Trixter Warrior Pants' where slug = 'trixter-warrior-pants';
update public.equipment_catalog set name = '하이네스 던위치햇', wiki_title = 'Royal Dunwitch Hat' where slug = 'royal-dunwitch-hat';
update public.equipment_catalog set name = '이글아이 던위치로브', wiki_title = 'Eagle Eye Dunwitch Robe' where slug = 'eagle-eye-dunwitch-robe';
update public.equipment_catalog set name = '트릭스터 던위치팬츠', wiki_title = 'Trixter Dunwitch Pants' where slug = 'trixter-dunwitch-pants';
update public.equipment_catalog set name = '하이네스 레인져베레', wiki_title = 'Royal Ranger Beret' where slug = 'royal-ranger-beret';
update public.equipment_catalog set name = '이글아이 레인져후드', wiki_title = 'Eagle Eye Ranger Cowl' where slug = 'eagle-eye-ranger-cowl';
update public.equipment_catalog set name = '트릭스터 레인져팬츠', wiki_title = 'Trixter Ranger Pants' where slug = 'trixter-ranger-pants';
update public.equipment_catalog set name = '하이네스 어새신보닛', wiki_title = 'Royal Assassin Hood' where slug = 'royal-assassin-hood';
update public.equipment_catalog set name = '이글아이 어새신셔츠', wiki_title = 'Eagle Eye Assassin Shirt' where slug = 'eagle-eye-assassin-shirt';
update public.equipment_catalog set name = '트릭스터 어새신팬츠', wiki_title = 'Trixter Assassin Pants' where slug = 'trixter-assassin-pants';
update public.equipment_catalog set name = '하이네스 원더러햇', wiki_title = 'Royal Wanderer Hat' where slug = 'royal-wanderer-hat';
update public.equipment_catalog set name = '이글아이 원더러코트', wiki_title = 'Eagle Eye Wanderer Coat' where slug = 'eagle-eye-wanderer-coat';
update public.equipment_catalog set name = '트릭스터 원더러팬츠', wiki_title = 'Trixter Wanderer Pants' where slug = 'trixter-wanderer-pants';
update public.equipment_catalog set wiki_title = 'Meister Shoulder', icon_url = 'https://media.maplestorywiki.net/yetidb/Eqp_Lionheart_Battle_Shoulder.png' where slug = 'meister-shoulder';

insert into public.equipment_catalog (slug, name, slot, part, job_group, level, icon_url, source_url) values
  ('virtues-medallion', '버츄스 메달', '보조 무기', '보조 무기', 'warrior', 100, null, null),
  ('sacred-rosary', '세이크리드 로사리오', '보조 무기', '보조 무기', 'warrior', 100, null, null),
  ('berserk-chain', '버서크 체인', '보조 무기', '보조 무기', 'warrior', 100, null, null),
  ('deimos-warrior-shield', '데이모스 워리어 실드', '보조 무기', '보조 무기', 'warrior', 130, null, null),
  ('rusty-book-epode', '적녹의 서 <종장>', '보조 무기', '보조 무기', 'magician', 100, 'https://media.maplestorywiki.net/yetidb/Eqp_Rusty_Book_(Epode).png', null),
  ('metallic-blue-book-epode', '청은의 서<종장>', '보조 무기', '보조 무기', 'magician', 100, 'https://media.maplestorywiki.net/yetidb/Eqp_Metallic_Blue_Book_(Epode).png', null),
  ('White-Gold-Book-Epode', '백금의 서 <종장>', '보조 무기', '보조 무기', 'magician', 100, 'https://media.maplestorywiki.net/yetidb/Eqp_White_Gold_Book_(Epode).png', null),
  ('deimos-sage-shield', '데이모스 세이지 실드', '보조 무기', '보조 무기', 'magician', 130, null, null),
  ('timeless-prelude', '피어리스 프렐류드', '보조 무기', '보조 무기', 'magician', 125, null, null),
  ('blasted-feather', '블라스트 페더', '보조 무기', '보조 무기', 'bowman', 100, null, null),
  ('true-shot', '전발적중', '보조 무기', '보조 무기', 'bowman', 100, null, null),
  ('perfect-relic', '퍼펙트 렐릭', '보조 무기', '보조 무기', 'bowman', 100, null, null),
  ('death-sender-charm', '파사부', '보조 무기', '보조 무기', 'thief', 100, null, null),
  ('slashing-shadow', '슬래싱 섀도우', '보조 무기', '보조 무기', 'thief', 100, null, null),
  ('arcane-umbra-katara', '아케인셰이드 블레이드', '보조 무기', '보조 무기', 'thief', 100, null, null),
  ('deimos-darkness-shield', '데이모스 다크니스 실드', '보조 무기', '보조 무기', 'thief', 130, null, null),
  ('wrist-armor', '리스트 아머', '보조 무기', '보조 무기', 'pirate', 100, null, null),
  ('falcon-eye', '팔콘아이', '보조 무기', '보조 무기', 'pirate', 100, null, null),
  ('center-fire-bomb', '봄버드 센터파이어', '보조 무기', '보조 무기', 'pirate', 100, null, null),
  ('Ereve-Brilliance', '에레브의 광휘', '보조 무기', '보조 무기', 'warrior', 100, null, null),
  ('Soul-Shield-of-Justice', '정의의 소울실드', '보조 무기', '보조 무기', 'warrior', 100, null, null),
  ('Masterwork-Charges', '익스플로시브 필<3호>', '보조 무기', '보조 무기', 'warrior', 100, null, null),
  ('Maximizer-Ball', '맥시마이즈 볼', '보조 무기', '보조 무기', 'magician', 100, null, null),
  ('wild-heron', '와일드 팡', '보조 무기', '보조 무기', 'bowman', 100, null, null),
  ('eternal-magnum', '이터널 매그넘', '보조 무기', '보조 무기', 'pirate', 100, null, null),
  ('Force-Shield-of-Extremes', '극한의 포스실드', '보조 무기', '보조 무기', 'warrior', 100, null, null),
  ('Octa-Core-Controller', '옥타코어 컨트롤러', '보조 무기', '보조 무기', 'pirate', 100, null, null),
  ('dragon-mass', '천룡추', '보조 무기', '보조 무기', 'warrior', 100, null, null),
  ('Dragon-Master%27s-Legacy', '드래곤마스터의 유산', '보조 무기', '보조 무기', 'magician', 100, null, null),
  ('Infinite-Magic-Arrows', '무한의 마법 화살', '보조 무기', '보조 무기', 'bowman', 100, null, null),
  ('Carte-Finale', '데르니에 카르트', '보조 무기', '보조 무기', 'thief', 100, null, null),
  ('Karma-Orb', '카르마 오브', '보조 무기', '보조 무기', 'magician', 100, null, null),
  ('Golden-Fox-Marble', '황금빛 여우구슬', '보조 무기', '보조 무기', 'pirate', 100, null, null),
  ('Nova-Truth-Essence', '진리의 노바의 정수', '보조 무기', '보조 무기', 'warrior', 100, null, null),
  ('D100-Custom-Weapon-Belt', 'D100 커스텀 웨폰 벨트', '보조 무기', '보조 무기', 'bowman', 100, null, null),
  ('Transmitter-Type-A', '트랜스미터 type:A', '보조 무기', '보조 무기', 'thief', 100, null, null),
  ('green-soul-ring', '그린 소울링', '보조 무기', '보조 무기', 'pirate', 100, null, null),
  ('Noble-Bladebinder', '노블 브레이슬릿', '보조 무기', '보조 무기', 'warrior', 100, null, null),
  ('Glory-Lucent-Wings', '글로리 매직윙', '보조 무기', '보조 무기', 'magician', 100, null, null),
  ('Ultimate-Path', '얼티밋 패스', '보조 무기', '보조 무기', 'pirate', 100, null, null),
  ('Queen-Chess-Piece', '체스피스 디 퀸', '보조 무기', '보조 무기', 'magician', 100, null, null),
  ('Moonstone-Fan-Tassel', '월장석 선추', '보조 무기', '보조 무기', 'thief', 100, null, null),
  ('lara-radiant-four-jade-ornament', '빛나는 사옥 노리개', '보조 무기', '보조 무기', 'magician', 10, 'https://media.maplestorywiki.net/yetidb/Eqp_Radiant_Four-Jade_Ornament.png', null),
  ('Violet-Imugi-Gem', '자색 여의보주', '보조 무기', '보조 무기', 'warrior', 10, null, null),
  ('Infinite-Hex-Seeker', '인피니트 헥스시커', '보조 무기', '보조 무기', 'thief', 10, null, null)
on conflict (slug) do update set
  name = excluded.name,
  slot = excluded.slot,
  part = excluded.part,
  job_group = excluded.job_group,
  level = excluded.level,
  icon_url = excluded.icon_url,
  source_url = excluded.source_url,
  source = excluded.source,
  updated_at = now();

insert into public.equipment_catalog (slug, name, slot, part, job_group, level, icon_url, source_url) values
  ('mitras-rage-warrior', '미트라의 분노(전사)', '엠블렘', '엠블렘', 'warrior', 100, 'https://media.maplestorywiki.net/yetidb/Eqp_Mitra''s_Rage_Warrior.png', null),
  ('mitras-rage-bowman', '미트라의 분노(궁수)', '엠블렘', '엠블렘', 'bowman', 100, 'https://media.maplestorywiki.net/yetidb/Eqp_Mitra''s_Rage_Bowman.png', null),
  ('mitras-rage-thief', '미트라의 분노(도적)', '엠블렘', '엠블렘', 'thief', 100, 'https://media.maplestorywiki.net/yetidb/Eqp_Mitra''s_Rage_Thief.png', null),
  ('mitras-rage-magician', '미트라의 분노(마법사)', '엠블렘', '엠블렘', 'magician', 100, 'https://media.maplestorywiki.net/yetidb/Eqp_Mitra''s_Rage_Magician.png', null),
  ('mitras-rage-pirate', '미트라의 분노(해적)', '엠블렘', '엠블렘', 'pirate', 100, 'https://media.maplestorywiki.net/yetidb/Eqp_Mitra''s_Rage_Pirate.png', null),
  ('hybrid-heart', '하이브리드 하트', '엠블렘', '엠블렘', 'pirate', 100, 'https://maplestorywiki.net/w/Hybrid_Heart#/media/File:Eqp_Hybrid_Heart.png', null)
  

on conflict (slug) do update set
  name = excluded.name,
  slot = excluded.slot,
  part = excluded.part,
  job_group = excluded.job_group,
  level = excluded.level,
  icon_url = excluded.icon_url,
  source_url = excluded.source_url,
  source = excluded.source,
  updated_at = now();
