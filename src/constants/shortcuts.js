// The keyboard shortcuts, in one place so the help panel and the bindings
// cannot drift apart.
//
// `boundHere: true` means `useGlobalShortcuts` listens for it, and the key
// listed is the key it listens for. The rest are documented here but bound
// where the behavior lives — section traversal in `useSongSectionNavigation`,
// page traversal in `MediaManager`. Those were already working and are left
// alone; this list is what the operator is shown.

export const SHORTCUT_GROUPS = [
  {
    id: 'projection',
    titleKey: 'shortcuts.groupProjection',
    titleFallback: 'Projection',
    items: [
      {
        id: 'blackout',
        key: 'b',
        display: ['B'],
        labelKey: 'shortcuts.blackout',
        labelFallback: 'Black the screen, or bring back what was on it',
        boundHere: true,
      },
    ],
  },
  {
    id: 'navigation',
    titleKey: 'shortcuts.groupNavigation',
    titleFallback: 'Moving through a song or document',
    items: [
      {
        id: 'previous',
        display: ['←', '↑', 'PageUp'],
        labelKey: 'shortcuts.previous',
        labelFallback: 'Previous section or page',
      },
      {
        id: 'next',
        display: ['→', '↓', 'PageDown'],
        labelKey: 'shortcuts.next',
        labelFallback: 'Next section or page',
      },
      {
        id: 'first',
        display: ['Home'],
        labelKey: 'shortcuts.first',
        labelFallback: 'Jump to the first section',
      },
      {
        id: 'last',
        display: ['End'],
        labelKey: 'shortcuts.last',
        labelFallback: 'Jump to the last section',
      },
    ],
  },
  {
    id: 'help',
    titleKey: 'shortcuts.groupHelp',
    titleFallback: 'Help',
    items: [
      {
        id: 'help',
        key: '?',
        display: ['?'],
        labelKey: 'shortcuts.help',
        labelFallback: 'Show this list',
        boundHere: true,
      },
    ],
  },
];

/** Flat list of every documented shortcut. */
export const ALL_SHORTCUTS = SHORTCUT_GROUPS.flatMap((group) => group.items);

/** The ones `useGlobalShortcuts` is responsible for listening to. */
export const GLOBAL_SHORTCUTS = ALL_SHORTCUTS.filter((item) => item.boundHere);

export default SHORTCUT_GROUPS;
