// Languages Aura can transcribe + generate in. Label is stored on the session;
// locale is the BCP-47 tag for the Web Speech API.
export const LANGUAGES: { label: string; locale: string }[] = [
  { label: "English", locale: "en-US" },
  { label: "Hindi", locale: "hi-IN" },
  { label: "Marathi", locale: "mr-IN" },
];

export function localeFor(label: string): string {
  return LANGUAGES.find((l) => l.label === label)?.locale ?? "en-US";
}
