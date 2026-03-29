import { useMemo } from 'react';
import { useRecoilCallback } from 'recoil';
import { useRecoilValue } from 'recoil';
import { GraduationCap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { RecoilState } from 'recoil';
import type { BadgeItem } from '~/common';
import { useLocalize, TranslationKeys } from '~/hooks';
import store from '~/store';

interface ChatBadgeConfig {
  id: string;
  icon: LucideIcon;
  label: string;
  atom: RecoilState<boolean>;
}

const badgeConfig: ReadonlyArray<ChatBadgeConfig> = [
  {
    id: '1',
    icon: GraduationCap,
    label: 'com_ui_learning_mode',
    atom: store.learningMode,
  },
];

export default function useChatBadges(): BadgeItem[] {
  const localize = useLocalize();
  const activeBadges = useRecoilValue(store.chatBadges) as Array<{ id: string }>;
  const activeBadgeIds = useMemo(
    () => new Set(activeBadges.map((badge) => badge.id)),
    [activeBadges],
  );
  const allBadges = useMemo(() => {
    return (
      badgeConfig.map((cfg) => ({
        id: cfg.id,
        label: localize(cfg.label as TranslationKeys),
        icon: cfg.icon,
        atom: cfg.atom,
        isAvailable: activeBadgeIds.has(cfg.id),
      })) || []
    );
  }, [activeBadgeIds, localize]);
  return allBadges;
}

export function useResetChatBadges() {
  return useRecoilCallback(
    ({ reset }) =>
      () => {
        badgeConfig.forEach(({ atom }) => reset(atom));
        reset(store.chatBadges);
      },
    [],
  );
}
