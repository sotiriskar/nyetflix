/**
 * Shared language labels and subtitle preference options for settings and player.
 * Keeps Account Settings "Subtitle appearance" and player caption logic in sync.
 */

/** Language code -> display label (ISO 639-1 and 639-2). */
export const LANG_LABELS: Record<string, string> = {
  en: 'English', eng: 'English',
  el: 'Greek', ell: 'Greek', gre: 'Greek', gr: 'Greek',
  es: 'Spanish', spa: 'Spanish',
  fr: 'French', fra: 'French', fre: 'French',
  de: 'German', deu: 'German', ger: 'German',
  it: 'Italian', ita: 'Italian',
  pt: 'Portuguese', por: 'Portuguese',
  ru: 'Russian', rus: 'Russian',
  ja: 'Japanese', jpn: 'Japanese',
  zh: 'Chinese', zho: 'Chinese', chi: 'Chinese',
  ko: 'Korean', kor: 'Korean',
  ar: 'Arabic', ara: 'Arabic',
  tr: 'Turkish', tur: 'Turkish',
  nl: 'Dutch', nld: 'Dutch', dut: 'Dutch',
  pl: 'Polish', pol: 'Polish',
  sv: 'Swedish', swe: 'Swedish',
  hi: 'Hindi', hin: 'Hindi',
  th: 'Thai', tha: 'Thai',
  vi: 'Vietnamese', vie: 'Vietnamese',
  id: 'Indonesian', ind: 'Indonesian',
  ms: 'Malay', msa: 'Malay', may: 'Malay',
  ca: 'Catalan', cat: 'Catalan',
  cs: 'Czech', cze: 'Czech', ces: 'Czech',
  da: 'Danish', dan: 'Danish',
  eu: 'Basque', baq: 'Basque', eus: 'Basque',
  fi: 'Finnish', fin: 'Finnish',
  fil: 'Filipino',
  gl: 'Galician', glg: 'Galician',
  he: 'Hebrew', heb: 'Hebrew',
  hu: 'Hungarian', hun: 'Hungarian',
  is: 'Icelandic', isl: 'Icelandic', ice: 'Icelandic',
  no: 'Norwegian', nor: 'Norwegian', nob: 'Norwegian Bokmål', nno: 'Norwegian Nynorsk',
  ro: 'Romanian', ron: 'Romanian', rum: 'Romanian',
  sk: 'Slovak', slk: 'Slovak', slo: 'Slovak',
  uk: 'Ukrainian', ukr: 'Ukrainian',
  hr: 'Croatian', hrv: 'Croatian',
  bg: 'Bulgarian', bul: 'Bulgarian',
  et: 'Estonian', est: 'Estonian',
  lv: 'Latvian', lav: 'Latvian',
  lt: 'Lithuanian', lit: 'Lithuanian',
  mk: 'North Macedonian', mac: 'North Macedonian', mkd: 'North Macedonian',
  sl: 'Slovenian', slv: 'Slovenian',
  sr: 'Serbian', srp: 'Serbian',
  und: 'Unknown',
};

/** Subtitle preference: 'off' or any language code from LANG_LABELS. */
export type SubtitlePreferenceValue = 'off' | string;

/** Options for Account Settings "Subtitle appearance" dropdown: Off + all languages (one per label). */
export const SUBTITLE_PREFERENCE_OPTIONS: { value: SubtitlePreferenceValue; label: string }[] = (() => {
  const byLabel = new Map<string, string>();
  for (const [code, label] of Object.entries(LANG_LABELS)) {
    if (label === 'Unknown') continue;
    if (!byLabel.has(label)) byLabel.set(label, code);
  }
  const langEntries = [...byLabel.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return [
    { value: 'off', label: 'Off' },
    ...langEntries.map(([label, code]) => ({ value: code as SubtitlePreferenceValue, label })),
  ];
})();
