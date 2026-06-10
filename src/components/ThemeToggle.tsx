import { useSettingsStore } from "../stores/settings-store";

export function ThemeToggle() {
  const toggleTheme = () => {
    const theme = useSettingsStore.getState().theme;
    useSettingsStore.getState().setTheme(theme === "light" ? "dark" : "light");
  };
  const theme = useSettingsStore((s) => s.theme);

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={theme === "light" ? "切换深色模式" : "切换浅色模式"}
      aria-label={theme === "light" ? "切换深色模式" : "切换浅色模式"}
      className="theme-toggle-btn flex h-7 w-7 items-center justify-center rounded-full transition-colors"
      style={{ color: "var(--text-primary)" }}
    >
      {theme === "light" ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          width="15"
          height="15"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          width="15"
          height="15"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      )}
    </button>
  );
}
