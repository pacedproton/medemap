const STORAGE_KEY = 'medemap.ai.accessKey';
export const ACCESS_KEY_HEADER_NAME = 'X-AI-Access-Key';

// Storage can be blocked (private windows, site settings), so every access is guarded
export function getAccessKey(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY)?.trim() ?? '';
  } catch {
    return '';
  }
}

export function setAccessKey(key: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, key.trim());
  } catch {
    // not remembered; the user will be asked again next time
  }
}

export function clearAccessKey(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing to clear
  }
}

/** Request headers for the AI endpoints: the stored key, when there is one. */
export function aiHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const key = getAccessKey();
  return key ? { ...extra, [ACCESS_KEY_HEADER_NAME]: key } : { ...extra };
}
