let counter = 0;

/** 衝突しない短いIDを生成する。 */
export function uid(prefix = 'a'): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}
