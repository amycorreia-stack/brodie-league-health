/**
 * Inline script that runs synchronously BEFORE first paint to set the
 * `data-theme` attribute on <html>. Prevents the flash-of-wrong-theme that
 * happens if you wait for React to hydrate.
 */
export function ThemeScript() {
  const code = `
    (function () {
      try {
        var stored = localStorage.getItem('blh-theme');
        var theme = stored || 'dark';
        if (theme !== 'dark' && theme !== 'light') theme = 'dark';
        document.documentElement.setAttribute('data-theme', theme);
      } catch (e) {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
