/**
 * ngrok free tier shows a browser interstitial unless clients send this header.
 * @see https://ngrok.com/docs/troubleshooting/ERR_NGROK_6024
 */
export const NGROK_SKIP_BROWSER_WARNING_VALUE = '69420';

export function isNgrokUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const withProto = url.includes('://') ? url : `https://${url}`;
    return /ngrok/i.test(new URL(withProto).hostname);
  } catch {
    return /ngrok/i.test(url);
  }
}

/** Merge into fetch / XHR / WebView request headers when calling an ngrok URL. */
export function ngrokClientHeaders(): Record<string, string> {
  return { 'ngrok-skip-browser-warning': NGROK_SKIP_BROWSER_WARNING_VALUE };
}
