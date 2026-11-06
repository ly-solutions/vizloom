/** Every word the table renders. Pass a partial override through `strings` to translate or rephrase. */
export interface TableStrings {
  total: string;
  search: string;
  searchClear: string;
  filters: string;
  filtersCount: (n: number) => string;
  filter: (column: string) => string;
  filterAction: string;
  activeFilters: string;
  removeFilter: (column: string) => string;
  removeSearch: string;
  searchChip: (query: string) => string;
  reset: string;
  resetAll: string;
  done: string;
  any: string;
  backToFilters: string;
  find: string;
  contains: string;
  from: string;
  to: string;
  since: string;
  until: string;
  rangeFrom: (value: string) => string;
  rangeTo: (value: string) => string;
  andMore: (first: string, rest: number) => string;
  matchedOf: (matched: string, total: string) => string;
  datePresets: readonly { label: string; days: number }[];
  settings: string;
  settingsTitle: string;
  columns: string;
  grouping: string;
  noGrouping: string;
  density: string;
  densityRegular: string;
  densityCompact: string;
  view: string;
  resetSettings: string;
  moveColumn: (column: string) => string;
  pinColumn: (column: string) => string;
  pinNone: string;
  pinStart: string;
  pinEnd: string;
  unpin: string;
  hideColumn: string;
  columnActions: (column: string) => string;
  columnWidth: (column: string) => string;
  sortAscending: string;
  sortDescending: string;
  noSort: string;
  sortBy: (column: string) => string;
  sortedBy: (column: string, descending: boolean) => string;
  sortLabel: (column: string) => string;
  cardsNoSort: string;
  cardsSorting: string;
  sortColumn: string;
  whatIs: (column: string) => string;
  columnFiltered: string;
  selectRow: string;
  selectAll: string;
  selectGroup: (group: string) => string;
  selectedOf: (selected: string, total: string) => string;
  clearSelection: string;
  selectedRegion: string;
  expandRow: string;
  collapseRow: string;
  expandAll: string;
  collapseAll: string;
  rowActions: string;
  actions: string;
  more: string;
  details: string;
  exportCsv: string;
  exportXlsx: string;
  pageRange: (from: string, to: string, total: string) => string;
  previousPage: string;
  nextPage: string;
  perPage: (n: number) => string;
  rowsPerPage: string;
  showMore: (n: string) => string;
  shown: (shown: string, total: string) => string;
  empty: string;
  noMatches: string;
  noMatchesReason: string;
  resetFilters: string;
  loadError: string;
  refreshError: string;
  retry: string;
  noAccess: string;
  noAccessReason: string;
  unknown: string;
  totalUnknown: string;
  totalUnknownBecause: (reason: string) => string;
  increased: (delta: string) => string;
  decreased: (delta: string) => string;
  updated: string;
  partial: string;
}

export const TABLE_STRINGS_EN: TableStrings = {
  total: 'Total',
  search: 'Search',
  searchClear: 'Clear search',
  filters: 'Filters',
  filtersCount: (n) => `Filters: ${n}`,
  filter: (column) => `Filter: ${column}`,
  filterAction: 'Filter…',
  activeFilters: 'Active filters',
  removeFilter: (column) => `Remove filter “${column}”`,
  removeSearch: 'Remove search',
  searchChip: (query) => `Search: “${query}”`,
  reset: 'Reset',
  resetAll: 'Reset all',
  done: 'Done',
  any: 'Any',
  backToFilters: 'All filters',
  find: 'Find',
  contains: 'Contains…',
  from: 'From',
  to: 'To',
  since: 'From',
  until: 'To',
  rangeFrom: (value) => `from ${value}`,
  rangeTo: (value) => `up to ${value}`,
  andMore: (first, rest) => `${first} and ${rest} more`,
  matchedOf: (matched, total) => `${matched} of ${total}`,
  datePresets: [
    { label: 'Today', days: 0 },
    { label: '7 days', days: 6 },
    { label: '30 days', days: 29 },
  ],
  settings: 'Customize',
  settingsTitle: 'Customize table',
  columns: 'Columns',
  grouping: 'Grouping',
  noGrouping: 'No groups',
  density: 'Density',
  densityRegular: 'Regular',
  densityCompact: 'Compact',
  view: 'View',
  resetSettings: 'Reset to default',
  moveColumn: (column) => `Move “${column}”: arrow up and down`,
  pinColumn: (column) => `Pin “${column}”`,
  pinNone: 'Not pinned',
  pinStart: 'Left',
  pinEnd: 'Right',
  unpin: 'Unpin',
  hideColumn: 'Hide column',
  columnActions: (column) => `Column “${column}” actions`,
  columnWidth: (column) => `Width of “${column}”`,
  sortAscending: 'Ascending',
  sortDescending: 'Descending',
  noSort: 'No sorting',
  sortBy: (column) => `${column}, sort`,
  sortedBy: (column, descending) => `${column}, sorted ${descending ? 'descending' : 'ascending'}`,
  sortLabel: (column) => `Sort: ${column}`,
  cardsNoSort: 'Not sorted',
  cardsSorting: 'Sorting',
  sortColumn: 'Column',
  whatIs: (column) => `What is “${column}”`,
  columnFiltered: 'Column is filtered',
  selectRow: 'Select row',
  selectAll: 'Select all rows',
  selectGroup: (group) => `Select group “${group}”`,
  selectedOf: (selected, total) => `${selected} of ${total} selected`,
  clearSelection: 'Clear selection',
  selectedRegion: 'Selected rows',
  expandRow: 'Show details',
  collapseRow: 'Hide details',
  expandAll: 'Expand all',
  collapseAll: 'Collapse all',
  rowActions: 'Row actions',
  actions: 'Actions',
  more: 'More',
  details: 'Details',
  exportCsv: 'Export CSV',
  exportXlsx: 'Export to Excel',
  pageRange: (from, to, total) => `${from}–${to} of ${total}`,
  previousPage: 'Previous page',
  nextPage: 'Next page',
  perPage: (n) => `${n} per page`,
  rowsPerPage: 'Rows per page',
  showMore: (n) => (n === '' ? 'Show more' : `Show ${n} more`),
  shown: (shown, total) => `Showing ${shown} of ${total}`,
  empty: 'Nothing here yet',
  noMatches: 'Nothing found',
  noMatchesReason: 'No rows match these filters and search',
  resetFilters: 'Reset filters',
  loadError: 'Could not load data',
  refreshError: 'Could not refresh data — showing the previous version',
  retry: 'Retry',
  noAccess: 'No access',
  noAccessReason: 'Ask the owner for access to this data.',
  unknown: 'No data',
  totalUnknown: 'Total is not calculated: some rows have no data',
  totalUnknownBecause: (reason) => `Total is not calculated: ${reason}`,
  increased: (delta) => `increased by ${delta}`,
  decreased: (delta) => `decreased by ${delta}`,
  updated: 'updated',
  partial: 'Partial data: some of it is still being collected',
};

export const TABLE_STRINGS_RU: TableStrings = {
  total: 'Итого',
  search: 'Поиск',
  searchClear: 'Очистить поиск',
  filters: 'Фильтры',
  filtersCount: (n) => `Фильтры: ${n}`,
  filter: (column) => `Фильтр: ${column}`,
  filterAction: 'Фильтр…',
  activeFilters: 'Действующие фильтры',
  removeFilter: (column) => `Убрать фильтр «${column}»`,
  removeSearch: 'Убрать поиск',
  searchChip: (query) => `Поиск: «${query}»`,
  reset: 'Сбросить',
  resetAll: 'Сбросить все',
  done: 'Готово',
  any: 'Любое',
  backToFilters: 'Ко всем фильтрам',
  find: 'Найти',
  contains: 'Содержит…',
  from: 'От',
  to: 'До',
  since: 'С',
  until: 'По',
  rangeFrom: (value) => `от ${value}`,
  rangeTo: (value) => `до ${value}`,
  andMore: (first, rest) => `${first} и ещё ${rest}`,
  matchedOf: (matched, total) => `${matched} из ${total}`,
  datePresets: [
    { label: 'Сегодня', days: 0 },
    { label: '7 дней', days: 6 },
    { label: '30 дней', days: 29 },
  ],
  settings: 'Настроить',
  settingsTitle: 'Настроить таблицу',
  columns: 'Столбцы',
  grouping: 'Группировка',
  noGrouping: 'Без групп',
  density: 'Плотность',
  densityRegular: 'Обычная',
  densityCompact: 'Плотная',
  view: 'Вид',
  resetSettings: 'Вернуть как было',
  moveColumn: (column) => `Переместить «${column}»: стрелки вверх и вниз`,
  pinColumn: (column) => `Закрепить «${column}»`,
  pinNone: 'Не закреплять',
  pinStart: 'Слева',
  pinEnd: 'Справа',
  unpin: 'Открепить',
  hideColumn: 'Скрыть столбец',
  columnActions: (column) => `Действия со столбцом «${column}»`,
  columnWidth: (column) => `Ширина столбца «${column}»`,
  sortAscending: 'По возрастанию',
  sortDescending: 'По убыванию',
  noSort: 'Без сортировки',
  sortBy: (column) => `${column}, сортировать`,
  sortedBy: (column, descending) => `${column}, сортировка ${descending ? 'по убыванию' : 'по возрастанию'}`,
  sortLabel: (column) => `Сортировка: ${column}`,
  cardsNoSort: 'Без сортировки',
  cardsSorting: 'Сортировка',
  sortColumn: 'Столбец',
  whatIs: (column) => `Что такое «${column}»`,
  columnFiltered: 'Столбец отфильтрован',
  selectRow: 'Выбрать строку',
  selectAll: 'Выбрать все строки',
  selectGroup: (group) => `Выбрать группу «${group}»`,
  selectedOf: (selected, total) => `Выбрано ${selected} из ${total}`,
  clearSelection: 'Снять выбор',
  selectedRegion: 'Выбранные строки',
  expandRow: 'Показать подробности',
  collapseRow: 'Скрыть подробности',
  expandAll: 'Раскрыть все',
  collapseAll: 'Свернуть все',
  rowActions: 'Действия со строкой',
  actions: 'Действия',
  more: 'Ещё',
  details: 'Подробно',
  exportCsv: 'Выгрузить CSV',
  exportXlsx: 'Выгрузить в Excel',
  pageRange: (from, to, total) => `${from}–${to} из ${total}`,
  previousPage: 'Предыдущая страница',
  nextPage: 'Следующая страница',
  perPage: (n) => `По ${n}`,
  rowsPerPage: 'Строк на странице',
  showMore: (n) => (n === '' ? 'Показать ещё' : `Показать ещё ${n}`),
  shown: (shown, total) => `Показано ${shown} из ${total}`,
  empty: 'Пока пусто',
  noMatches: 'Ничего не найдено',
  noMatchesReason: 'По этим фильтрам и поиску строк нет',
  resetFilters: 'Сбросить фильтры',
  loadError: 'Не удалось загрузить данные',
  refreshError: 'Не удалось обновить данные — показаны прежние',
  retry: 'Повторить',
  noAccess: 'Нет доступа',
  noAccessReason: 'Попросите владельца открыть доступ к этим данным.',
  unknown: 'Нет данных',
  totalUnknown: 'Итог не считается: по части строк нет данных',
  totalUnknownBecause: (reason) => `Итог не считается: ${reason}`,
  increased: (delta) => `выросло на ${delta}`,
  decreased: (delta) => `снизилось на ${delta}`,
  updated: 'обновлено',
  partial: 'Данные неполные: часть ещё собирается',
};

/** Built-in strings for a locale code (`ru`, `ru-RU`, …); English otherwise. */
export function tableStringsFor(code: string): TableStrings {
  return code.toLowerCase().startsWith('ru') ? TABLE_STRINGS_RU : TABLE_STRINGS_EN;
}
