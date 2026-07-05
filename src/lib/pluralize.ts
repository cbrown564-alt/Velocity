/** Count + singular/plural noun label (e.g. "1 dataset", "3 datasets"). */
export function pluralize(count: number, singular: string, pluralForm = `${singular}s`): string {
  const label = count === 1 ? singular : pluralForm;
  return `${count.toLocaleString()} ${label}`;
}
