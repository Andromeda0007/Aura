// Languages Aura can transcribe + generate in. Label is stored on the session;
// locale is the BCP-47 tag for the Web Speech API.
export const LANGUAGES: { label: string; locale: string }[] = [
  { label: "English", locale: "en-US" },
  { label: "Spanish", locale: "es-ES" },
  { label: "French", locale: "fr-FR" },
  { label: "German", locale: "de-DE" },
  { label: "Hindi", locale: "hi-IN" },
  { label: "Mandarin Chinese", locale: "zh-CN" },
  { label: "Arabic", locale: "ar-SA" },
  { label: "Portuguese", locale: "pt-BR" },
  { label: "Japanese", locale: "ja-JP" },
];

export function localeFor(label: string): string {
  return LANGUAGES.find((l) => l.label === label)?.locale ?? "en-US";
}
