import React from 'react';
import { Palette, Check } from 'lucide-react';

export type VaultThemeId =
  | 'obsidian'
  | 'amoled'
  | 'alabaster'
  | 'cyber-emerald'
  | 'nordic-cobalt'
  | 'sunset-amber'
  | 'titanium-sand';

export type AccentPaletteId = 'cyan' | 'emerald' | 'cobalt' | 'amber';

export interface ThemeOption {
  id: VaultThemeId;
  label: string;
  shortLabel: string;
  description: string;
  swatchColor: string;
  accentColor: string;
}

export const VAULT_THEMES: ThemeOption[] = [
  {
    id: 'obsidian',
    label: 'System Dark (M3 Slate)',
    shortLabel: 'System',
    description:
      'Deep Slate (#0B0F19) & Elevated Charcoal (#131B2E) with Electric Cyan (#38BDF8)',
    swatchColor: '#0B0F19',
    accentColor: '#38BDF8',
  },
  {
    id: 'amoled',
    label: 'Pure AMOLED Dark',
    shortLabel: 'AMOLED',
    description:
      'True #000000 OLED black canvas with high-contrast Material You tonal surfaces',
    swatchColor: '#000000',
    accentColor: '#38BDF8',
  },
  {
    id: 'alabaster',
    label: 'Clean Light',
    shortLabel: 'Light',
    description: 'High-contrast daylight slate financial ledger surface',
    swatchColor: '#F8FAFC',
    accentColor: '#0284C7',
  },
  {
    id: 'cyber-emerald',
    label: 'Emerald Enclave',
    shortLabel: 'Emerald',
    description: 'Biometric hardware vault palette in deep forest tones',
    swatchColor: '#05110E',
    accentColor: '#34D399',
  },
  {
    id: 'nordic-cobalt',
    label: 'Royal Cobalt',
    shortLabel: 'Cobalt',
    description: 'Midnight navy analytical console with cobalt accents',
    swatchColor: '#070E1D',
    accentColor: '#60A5FA',
  },
  {
    id: 'sunset-amber',
    label: 'Sunset Amber',
    shortLabel: 'Amber',
    description: 'Warm obsidian surface paired with radiant gold-amber accents',
    swatchColor: '#120D07',
    accentColor: '#FBBF24',
  },
];

interface ThemeSwitcherBarProps {
  activeTheme: VaultThemeId;
  onSelectTheme: (theme: VaultThemeId) => void;
  variant?: 'compact' | 'gallery';
}

export const ThemeSwitcherBar: React.FC<ThemeSwitcherBarProps> = ({
  activeTheme,
  onSelectTheme,
  variant = 'compact',
}) => {
  if (variant === 'gallery') {
    return (
      <div
        role="group"
        aria-label="Theme Studio Gallery"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
      >
        {VAULT_THEMES.map((t) => {
          const isSelected = activeTheme === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTheme(t.id)}
              aria-pressed={isSelected}
              className={`text-left p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between min-h-[100px] ${
                isSelected
                  ? 'border-sky-500 bg-slate-50 ring-1 ring-sky-500'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="w-4 h-4 rounded-full border border-slate-400/50 shrink-0"
                    style={{ backgroundColor: t.swatchColor }}
                  />
                  <span
                    aria-hidden="true"
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: t.accentColor }}
                  />
                </div>
                {isSelected && (
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                )}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">
                  {t.label}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  {t.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="Interface Theme Selector"
      className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto max-w-full"
    >
      <span className="text-xs font-medium text-slate-500 flex items-center gap-1 px-2 shrink-0">
        <Palette className="w-3.5 h-3.5 text-sky-400" />
        <span className="hidden xl:inline">Monet</span>
      </span>
      {VAULT_THEMES.slice(0, 5).map((t) => {
        const isSelected = activeTheme === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelectTheme(t.id)}
            aria-pressed={isSelected}
            title={t.label}
            className={`min-h-[30px] px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              isSelected
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span
              aria-hidden="true"
              className="w-2.5 h-2.5 rounded-full border border-slate-400/50 shrink-0"
              style={{ backgroundColor: t.swatchColor }}
            />
            <span>{t.shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
};
