export const CATPPUCCIN_COLORS = [
  'rosewater',
  'flamingo',
  'pink',
  'mauve',
  'red',
  'maroon',
  'peach',
  'yellow',
  'green',
  'teal',
  'sky',
  'sapphire',
  'blue',
  'lavender',
] as const;

export type CatppuccinColor = (typeof CATPPUCCIN_COLORS)[number];

export type Theme = 'mocha' | 'latte';

export const THEME_STORAGE_KEY = 'habitpulse-theme';

export interface ThemePalette {
  name: Theme;
  base: string;
  mantle: string;
  crust: string;
  surface0: string;
  surface1: string;
  surface2: string;
  overlay0: string;
  text: string;
  subtext0: string;
  accents: Record<CatppuccinColor, string>;
}

export const MOCHA_PALETTE: ThemePalette = {
  name: 'mocha',
  base: '#1e1e2e',
  mantle: '#181825',
  crust: '#11111b',
  surface0: '#313244',
  surface1: '#45475a',
  surface2: '#585b70',
  overlay0: '#6c7086',
  text: '#cdd6f4',
  subtext0: '#a6adc8',
  accents: {
    rosewater: '#f5e0dc',
    flamingo: '#f2cdcd',
    pink: '#f5c2e7',
    mauve: '#cba6f7',
    red: '#f38ba8',
    maroon: '#eba0ac',
    peach: '#fab387',
    yellow: '#f9e2af',
    green: '#a6e3a1',
    teal: '#94e2d5',
    sky: '#89dceb',
    sapphire: '#74c7ec',
    blue: '#89b4fa',
    lavender: '#b4befe',
  },
};

export const LATTE_PALETTE: ThemePalette = {
  name: 'latte',
  base: '#eff1f5',
  mantle: '#e6e9ef',
  crust: '#dce0e8',
  surface0: '#ccd0da',
  surface1: '#bcc0cc',
  surface2: '#acb0be',
  overlay0: '#9ca0b0',
  text: '#4c4f69',
  subtext0: '#6c6f85',
  accents: {
    rosewater: '#dc8a78',
    flamingo: '#dd7878',
    pink: '#ea76cb',
    mauve: '#8839ef',
    red: '#d20f39',
    maroon: '#e64553',
    peach: '#fe640b',
    yellow: '#df8e1d',
    green: '#40a02b',
    teal: '#179299',
    sky: '#04a5e5',
    sapphire: '#209fb5',
    blue: '#1e66f5',
    lavender: '#7287fd',
  },
};

export const PALETTES: Record<Theme, ThemePalette> = {
  mocha: MOCHA_PALETTE,
  latte: LATTE_PALETTE,
};

export function getAccentHex(color: CatppuccinColor, theme: Theme = 'mocha'): string {
  const palette = PALETTES[theme] ?? MOCHA_PALETTE;
  return palette.accents[color] ?? palette.accents.mauve;
}
