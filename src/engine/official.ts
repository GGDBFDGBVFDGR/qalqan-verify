/** Домены, которые человек открывает сам. Совпадение поддомена считается официальным. */
export const OFFICIAL_DOMAINS = [
  "kaspi.kz",
  "halykbank.kz",
  "homebank.kz",
  "e.gov.kz",
  "egov.kz",
  "gov.kz",
  "nationalbank.kz",
  "npck.kz",
  "bcc.kz",
  "forte.kz",
  "jusan.kz",
  "altynbank.kz",
  "beeline.kz",
  "kcell.kz",
  "tele2.kz",
  "activ.kz",
  "kazakhtelecom.kz",
];

const BRANDS = [
  "kaspi",
  "halyk",
  "homebank",
  "egov",
  "e.gov",
  "nationalbank",
  "beeline",
  "kcell",
  "fortebank",
  "jusan",
];

export function hostnameOf(raw: string): string | null {
  const trimmed = raw.trim().replace(/[),.;]+$/g, "");
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const host = new URL(withProtocol).hostname.toLowerCase().replace(/^www\./, "");
    if (!host.includes(".") || host.endsWith(".")) return null;
    return host;
  } catch {
    return null;
  }
}

export function isOfficialHost(host: string): boolean {
  return OFFICIAL_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

/** egov.kz.gov-notice.info — официальное имя стоит первым, регистрация чужая. */
export function isPrefixLookalike(host: string): boolean {
  const labels = host.split(".");
  for (let take = 2; take < labels.length; take += 1) {
    const head = labels.slice(0, take).join(".");
    if (OFFICIAL_DOMAINS.includes(head)) return true;
  }
  return false;
}

export function mentionsBrand(host: string): boolean {
  return BRANDS.some((brand) => host.includes(brand));
}

export function classifyHost(host: string): "official" | "lookalike" | "other" {
  if (isPrefixLookalike(host)) return "lookalike";
  if (isOfficialHost(host)) return "official";
  if (mentionsBrand(host)) return "lookalike";
  return "other";
}
