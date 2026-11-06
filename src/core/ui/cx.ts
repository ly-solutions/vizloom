/** Joins truthy class names. */
export function cx(...parts: ReadonlyArray<string | false | null | undefined | 0>): string {
  let out = '';
  for (const p of parts) if (p) out = out ? `${out} ${p}` : p;
  return out;
}
