'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Input } from '@/shared/ui/Input';
import { useAuthStore } from '@/shared/lib/stores/useAuthStore';
import { useExpenseStore } from '@/shared/lib/stores/useExpenseStore';
import { formatDateKorean } from '@/shared/lib/utils/formatters';
import type { Expense } from '@/shared/types';
import {
  MAPLE_POINT_KIND_META,
  MAPLE_POINT_SCHEDULE_META,
  MAPLE_POINT_SEEDS,
  type MaplePointKind,
  type MaplePointSchedule,
  type MaplePointSeedTemplate,
  type MaplePointTemplate,
  buildMaplePointMemo,
  clearMaplePointAutoSaveConfig,
  formatPointAmount,
  getLocalDateKey,
  getMaplePointAutoSaveStorageKey,
  getTemplateKey,
  getTemplateNextRunLabel,
  makeMaplePointTemplate,
  readMaplePointAutoSaveConfig,
  writeMaplePointAutoSaveConfig,
} from '@/shared/lib/maple-point-expenses';

export function MaplePointExpenseModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user?.id;
  const { localOwnerId } = useAuthStore();
  const { addExpense } = useExpenseStore();
  const [templates, setTemplates] = useState<MaplePointTemplate[]>(
    MAPLE_POINT_SEEDS.map(makeMaplePointTemplate),
  );
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [title, setTitle] = useState('');
  const [amountText, setAmountText] = useState('');
  const [kind, setKind] = useState<MaplePointKind>('routine');
  const [schedule, setSchedule] = useState<MaplePointSchedule>('daily');
  const [note, setNote] = useState('');
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const ownerKey = localOwnerId ?? session?.user?.id;
    if (!ownerKey) return;

    const saved = readMaplePointAutoSaveConfig(ownerKey);
    if (!saved) return;

    const seedTemplates = MAPLE_POINT_SEEDS.map(makeMaplePointTemplate);
    const hydratedTemplates = [...seedTemplates];
    const hydratedKeys = new Set(seedTemplates.map((template) => getTemplateKey(template)));

    for (const storedTemplate of saved.templates) {
      const matchedIndex = hydratedTemplates.findIndex(
        (template) => getTemplateKey(template) === getTemplateKey(storedTemplate),
      );
      if (matchedIndex >= 0) {
        hydratedTemplates[matchedIndex] = { ...hydratedTemplates[matchedIndex], selected: true };
        continue;
      }

      const storedKey = getTemplateKey(storedTemplate);
      if (hydratedKeys.has(storedKey)) continue;
      hydratedTemplates.push({
        id: crypto.randomUUID(),
        ...storedTemplate,
        selected: true,
      });
    }

    setTemplates(hydratedTemplates);
    setAutoSaveEnabled(saved.enabled);
  }, [localOwnerId, session?.user?.id]);

  const selectedCount = templates.filter((template) => template.selected).length;
  const selectedRoutineCount = templates.filter((template) => template.selected && template.kind === 'routine').length;
  const selectedConditionalCount = templates.filter((template) => template.selected && template.kind === 'conditional').length;
  const selectedShopCount = templates.filter((template) => template.selected && template.kind === 'shop').length;
  const selectedPointTotal = templates.reduce((sum, template) => {
    if (!template.selected) return sum;
    return sum + template.amount;
  }, 0);

  const sortedTemplates = useMemo(
    () => [...templates].sort((a, b) => b.amount - a.amount || a.title.localeCompare(b.title)),
    [templates],
  );

  const schedulePreview = useMemo(
    () => [
      {
        title: '매일 루틴',
        items: templates.filter((template) => template.selected && template.schedule === 'daily'),
      },
      {
        title: '조건형 / 요일형',
        items: templates.filter(
          (template) => template.selected && (template.schedule === 'weekly' || template.schedule === 'sunday'),
        ),
      },
      {
        title: '월간 / 상점형',
        items: templates.filter(
          (template) => template.selected && (template.schedule === 'monthly' || template.schedule === 'manual'),
        ),
      },
    ],
    [templates],
  );

  const addTemplate = () => {
    const amount = Number(amountText.replace(/,/g, ''));
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !Number.isFinite(amount) || amount <= 0) return;

    setTemplates((current) => [
      {
        id: crypto.randomUUID(),
        title: trimmedTitle,
        amount,
        kind,
        schedule,
        note: note.trim() || '사용자 정의 예약 항목',
        selected: false,
      },
      ...current,
    ]);

    setTitle('');
    setAmountText('');
    setKind('routine');
    setSchedule('daily');
    setNote('');
  };

  const applySeed = (seed: MaplePointSeedTemplate) => {
    setTitle(seed.title);
    setAmountText(String(seed.amount));
    setKind(seed.kind);
    setSchedule(seed.schedule);
    setNote(seed.note);
  };

  const persistAutoSaveConfig = (enabled: boolean, selectedTemplates: MaplePointSeedTemplate[], lastRunDate?: string) => {
    const ownerKey = localOwnerId ?? session?.user?.id;
    if (!ownerKey) return;

    if (!enabled) {
      clearMaplePointAutoSaveConfig(ownerKey);
      return;
    }

    writeMaplePointAutoSaveConfig(ownerKey, {
      enabled,
      templates: selectedTemplates,
      lastRunDate,
    });
  };

  const syncAutoSaveState = (enabled: boolean) => {
    setAutoSaveEnabled(enabled);
    const selectedTemplates = templates
      .filter((template) => template.selected)
      .map(({ title, amount, kind, schedule, note }) => ({
        title,
        amount,
        kind,
        schedule,
        note,
      }));
    persistAutoSaveConfig(enabled, selectedTemplates);
  };

  const toggleTemplate = (id: string) => {
    setTemplates((current) =>
      current.map((template) =>
        template.id === id ? { ...template, selected: !template.selected } : template,
      ),
    );
  };

  const handleSaveSelected = async () => {
    const selectedTemplates = templates.filter((template) => template.selected);
    if (!isLoggedIn || selectedTemplates.length === 0 || selectedPointTotal <= 0) return;

    setSaving(true);
    try {
      const today = new Date();
      const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
        today.getDate(),
      ).padStart(2, '0')}`;
      const expense: Omit<Expense, 'id' | 'created_at' | 'updated_at' | 'sync_status'> = {
        local_owner_id: localOwnerId ?? undefined,
        date,
        title: '메이플 포인트 지출',
        amount: selectedPointTotal,
        category: '메포',
        memo: buildMaplePointMemo(
          selectedTemplates.map(({ title, amount, kind, schedule, note }) => ({
            title,
            amount,
            kind,
            schedule,
            note,
          })),
        ),
      };

      await addExpense(expense, isLoggedIn);
      if (autoSaveEnabled) {
        persistAutoSaveConfig(
          true,
          selectedTemplates.map(({ title, amount, kind, schedule, note }) => ({
            title,
            amount,
            kind,
            schedule,
            note,
          })),
          getLocalDateKey(new Date()),
        );
      } else {
        persistAutoSaveConfig(false, []);
      }
      setTemplates((current) => current.map((template) => ({ ...template, selected: false })));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/60">
      <div className="flex h-full w-full flex-col bg-app">
        <div className="flex items-center justify-between border-b border-line px-4 py-4">
          <div>
            <h2 className="text-base font-bold text-t1">메이플 포인트 예약 입력</h2>
            <p className="mt-1 text-xs text-t3">매일 루틴, 몬파 썬데이, 메포샵 구매를 한 화면에서 구분해서 보세요.</p>
          </div>
          <button type="button" onClick={onClose} className="cursor-pointer text-sm font-medium text-t3">
            닫기
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
            <Card variant="highlight">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                  <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-amber-700">선택 {selectedCount}개</span>
                  <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-sky-700">루틴 {selectedRoutineCount}개</span>
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-700">
                    조건형 {selectedConditionalCount}개
                  </span>
                  <span className="rounded-full bg-violet-500/15 px-2.5 py-1 text-violet-700">
                    상점형 {selectedShopCount}개
                  </span>
                </div>
                <p className="text-sm font-bold text-amber-600">
                  {formatPointAmount(selectedPointTotal)}
                </p>
              </div>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
              <div className="space-y-3">
                <Card className="p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {sortedTemplates.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => toggleTemplate(template.id)}
                        aria-pressed={template.selected}
                        className={`group relative overflow-hidden rounded-3xl border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-500/15 ${
                          template.selected
                            ? 'border-amber-500/50 bg-[linear-gradient(150deg,rgba(245,158,11,0.14),rgba(245,158,11,0.05)_55%,rgba(255,255,255,0.65))] shadow-[0_16px_30px_rgba(217,119,6,0.18)]'
                            : 'border-line bg-card/90 shadow-[var(--shadow-sm)] hover:-translate-y-1 hover:border-amber-500/35 hover:bg-card hover:shadow-[0_14px_28px_rgba(0,0,0,0.08)] active:translate-y-0.5'
                        }`}
                      >
                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/35 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                        <div
                          className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                            template.selected
                              ? 'bg-amber-500 text-white'
                              : 'bg-surface text-t3 group-hover:bg-amber-500/15 group-hover:text-amber-700'
                          }`}
                        >
                          {template.selected ? '선택됨' : '선택'}
                        </div>

                        <div className="pr-16">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-base font-bold text-t1">{template.title}</p>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${MAPLE_POINT_KIND_META[template.kind].className}`}
                            >
                              {MAPLE_POINT_KIND_META[template.kind].label}
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-t3">{template.note}</p>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <div className="rounded-2xl border border-line bg-app/75 p-3 transition-colors group-hover:border-amber-500/20">
                            <p className="text-[11px] text-t3">금액</p>
                            <p className="mt-1 text-sm font-bold text-t1">{formatPointAmount(template.amount)}</p>
                          </div>
                          <div className="rounded-2xl border border-line bg-app/75 p-3 transition-colors group-hover:border-amber-500/20">
                            <p className="text-[11px] text-t3">주기</p>
                            <p className="mt-1 text-sm font-bold text-t1">
                              {MAPLE_POINT_SCHEDULE_META[template.schedule].label}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-t3">
                          <span>다음 실행 {getTemplateNextRunLabel(template.schedule)}</span>
                          <span>{template.selected ? '저장 대상' : '미선택'}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </Card>

                <Card className="p-4">
                  <p className="text-sm font-semibold text-t1">예약 미리보기</p>
                  <p className="mt-1 text-xs text-t3">선택한 항목만 아래 합계에 들어갑니다.</p>
                  <div className="mt-4 space-y-3">
                    {schedulePreview.map((group) => (
                      <div key={group.title} className="rounded-2xl bg-surface/70 p-3">
                        <p className="text-xs font-semibold text-t2">{group.title}</p>
                        <div className="mt-2 space-y-2">
                          {group.items.length > 0 ? (
                            group.items.map((template) => (
                              <div key={template.id} className="flex items-center justify-between gap-3 text-sm">
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-t1">{template.title}</p>
                                  <p className="text-[11px] text-t3">{template.note}</p>
                                </div>
                                <p className="shrink-0 font-bold text-t1">{formatPointAmount(template.amount)}</p>
                              </div>
                            ))
                          ) : (
                          <p className="text-xs text-t3">아직 항목이 없어요.</p>
                        )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-t1">선택 합계 저장</p>
                      <p className="mt-1 text-xs text-t3">선택된 항목의 총액을 지출 장부에 기록합니다.</p>
                    </div>
                    <p className="text-sm font-bold text-t1">{formatPointAmount(selectedPointTotal)}</p>
                  </div>
                  <div className="mt-4 rounded-2xl border border-line bg-surface/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-t1">자동 저장</p>
                        <p className="mt-0.5 text-[11px] text-t3">선택한 항목을 매주 수요일에 자동으로 서버에 기록해요.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => syncAutoSaveState(!autoSaveEnabled)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                          autoSaveEnabled
                            ? 'bg-amber-500 text-white'
                            : 'bg-white text-t3 hover:bg-amber-500/10 hover:text-amber-700'
                        }`}
                      >
                        {autoSaveEnabled ? '켜짐' : '꺼짐'}
                      </button>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="lg"
                    fullWidth
                    className="mt-4"
                    onClick={handleSaveSelected}
                    disabled={!localOwnerId || selectedCount === 0 || selectedPointTotal <= 0 || saving}
                  >
                    {saving ? '저장 중...' : '선택 항목 지출 저장'}
                  </Button>
                </Card>
              </div>

              <div className="space-y-3">
                <Card className="p-4">
                  <p className="text-sm font-semibold text-t1">예약 템플릿 추가</p>
                  <p className="mt-1 text-xs text-t3">새 항목을 직접 넣어서 필요할 때만 추가하세요.</p>

                  <div className="mt-4 space-y-3">
                    <Input label="항목 이름" placeholder="예: 몬파 썬데이 7판" value={title} onChange={(e) => setTitle(e.target.value)} />

                    <Input
                      label="예상 포인트"
                      placeholder="예: 20000"
                      value={amountText}
                      onChange={(e) => setAmountText(e.target.value.replace(/[^0-9,]/g, ''))}
                      suffix="P"
                      inputMode="numeric"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold tracking-[-0.01em] text-t2">유형</label>
                        <select
                          value={kind}
                          onChange={(e) => setKind(e.target.value as MaplePointKind)}
                          className="w-full rounded-xl border border-line-str bg-field px-4 py-3 text-base text-t1 shadow-[var(--shadow-sm)] focus:border-amber-500/80 focus:outline-none focus:ring-4 focus:ring-amber-500/10"
                        >
                          <option value="routine">루틴</option>
                          <option value="conditional">조건형</option>
                          <option value="shop">상점형</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold tracking-[-0.01em] text-t2">주기</label>
                        <select
                          value={schedule}
                          onChange={(e) => setSchedule(e.target.value as MaplePointSchedule)}
                          className="w-full rounded-xl border border-line-str bg-field px-4 py-3 text-base text-t1 shadow-[var(--shadow-sm)] focus:border-amber-500/80 focus:outline-none focus:ring-4 focus:ring-amber-500/10"
                        >
                          <option value="daily">매일</option>
                          <option value="weekly">주간</option>
                          <option value="sunday">썬데이</option>
                          <option value="monthly">월 1회</option>
                          <option value="manual">수동</option>
                        </select>
                      </div>
                    </div>

                    <Input label="메모 (선택)" placeholder="예: 썬데이만 7판" value={note} onChange={(e) => setNote(e.target.value)} />

                    <Button
                      type="button"
                      fullWidth
                      onClick={addTemplate}
                      disabled={!title.trim() || Number(amountText.replace(/,/g, '')) <= 0}
                    >
                      템플릿 추가
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
