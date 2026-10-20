import type { AdminSessionInfo } from "@rassm/shared";

// A small user agent reader for the Sécurité page and the alerts ("Chrome 141 · Windows").
// It only needs to be readable by a person, not exact.

export interface DeviceInfo {
  browser: string;
  os: string;
  deviceType: AdminSessionInfo["deviceType"];
}

const BROWSERS: [RegExp, string][] = [
  [/EdgA?\/(\d+)/, "Edge"],
  [/OPR\/(\d+)/, "Opera"],
  [/SamsungBrowser\/(\d+)/, "Samsung Internet"],
  [/Firefox\/(\d+)/, "Firefox"],
  [/FxiOS\/(\d+)/, "Firefox"],
  [/CriOS\/(\d+)/, "Chrome"],
  [/Chrome\/(\d+)/, "Chrome"],
  [/Version\/(\d+)[\d.]* (?:Mobile\/\S+ )?Safari\//, "Safari"],
];

function readOs(ua: string): string {
  if (/iPad/.test(ua)) return "iPadOS";
  if (/iPhone|iPod/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Système inconnu";
}

export function parseUserAgent(ua: string | null | undefined): DeviceInfo {
  if (!ua) return { browser: "Navigateur inconnu", os: "Système inconnu", deviceType: "unknown" };
  let browser = "Navigateur inconnu";
  for (const [pattern, name] of BROWSERS) {
    const match = pattern.exec(ua);
    if (match) {
      browser = `${name} ${match[1]}`;
      break;
    }
  }
  const os = readOs(ua);
  const deviceType: DeviceInfo["deviceType"] =
    /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))
      ? "tablet"
      : /Mobi|iPhone|iPod/.test(ua)
        ? "mobile"
        : os === "Système inconnu"
          ? "unknown"
          : "desktop";
  return { browser, os, deviceType };
}

const DEVICE_LABELS: Record<DeviceInfo["deviceType"], string> = {
  desktop: "ordinateur",
  mobile: "téléphone",
  tablet: "tablette",
  unknown: "appareil inconnu",
};

/** "Chrome 141 · Windows (ordinateur)" */
export function deviceLabel(info: DeviceInfo): string {
  return `${info.browser} · ${info.os} (${DEVICE_LABELS[info.deviceType]})`;
}
