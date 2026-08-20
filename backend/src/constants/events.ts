export const EVENT_TYPES = ['public', 'private'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_SORT_FIELDS = ['date', 'created_at'] as const;
export type EventSortField = (typeof EVENT_SORT_FIELDS)[number];

export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];
