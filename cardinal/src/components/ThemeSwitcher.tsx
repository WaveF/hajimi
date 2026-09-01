import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  applyThemePreference,
  getStoredThemePreference,
  persistThemePreference,
  type ThemePreference,
} from '../theme';

type ThemeSwitcherProps = {
  className?: string;
  resetToken?: number;
};

type ThemeOption = {
  value: ThemePreference;
  labelKey: string;
};

const THEME_OPTIONS: ThemeOption[] = [
  { value: 'system', labelKey: 'theme.options.system' },
  { value: 'light', labelKey: 'theme.options.light' },
  { value: 'dark', labelKey: 'theme.options.dark' },
];

const ThemeSwitcher = ({ className, resetToken }: ThemeSwitcherProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [preference, setPreference] = useState<ThemePreference>(() => getStoredThemePreference());

  useEffect(() => {
    persistThemePreference(preference);
    applyThemePreference(preference);
  }, [preference]);

  useEffect(() => {
    if (resetToken === undefined) return;
    setPreference(getStoredThemePreference());
  }, [resetToken]);

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextPreference = event.target.value as ThemePreference;
    setPreference(nextPreference);
  };

  return (
    <div className={className}>
      <select
        className="preferences-select"
        value={preference}
        onChange={handleChange}
        aria-label={t('theme.label')}
      >
        {THEME_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {t(option.labelKey)}
          </option>
        ))}
      </select>
    </div>
  );
};

export default ThemeSwitcher;
