/** Resolve packaged English/Korean messages without network requests or stored preferences. */
import english from "../static/_locales/en/messages.json";
import korean from "../static/_locales/ko/messages.json";

export type Language = "en" | "ko";
// Chrome follows its display language; unsupported locales fall back to English.
export const language: Language = (typeof chrome !== "undefined" && chrome.i18n
  ? chrome.i18n.getUILanguage()
  : "en"
).startsWith("ko")
  ? "ko"
  : "en";
const messages = language === "ko" ? korean : english;

/** All replacements are plain text; no message is inserted as executable HTML. */
export function m(
  key: keyof typeof english,
  values: (string | number)[] = [],
): string {
  return messages[key].message.replace(/\$(\d)/g, (_, n) =>
    String(values[Number(n) - 1] ?? ""),
  );
}
