/**
 * Die `id` eines Reiters aus `ViewTabs`. Das zugehörige `tabpanel` verweist
 * damit über `aria-labelledby` auf den ausgewählten Reiter zurück.
 *
 * Eigene Datei, weil `ViewTabs.tsx` ausschließlich Komponenten exportiert:
 * Ein zusätzlicher Wert-Export dort nähme dem Modul das Fast Refresh.
 */
export function viewTabId(idPrefix: string, tabId: string): string {
  return `${idPrefix}-tab-${tabId}`;
}
