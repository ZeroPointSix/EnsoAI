/**
 * Dev-channel identity — must stay isolated from production EnsoAIPlus.
 * This file is only on the `dev` branch; main uses production values in electron-builder.yml.
 */
export const BUILD_CHANNEL = 'dev' as const;

export const APP_USER_MODEL_ID = 'com.ensoaiplus.dev.app';

/** Deep-link protocol (not `enso` — avoids opening the production app). */
export const URL_SCHEME = 'enso-dev';

export const PRODUCT_NAME = 'EnsoAIPlus Dev';

/** Windows/macOS userData folder name under appData. */
export const USER_DATA_DIR_NAME = 'EnsoAIPlus Dev';

export const IDE_BRIDGE_NAME = 'EnsoAIPlus Dev';

export function ensoProtocolPrefix(): string {
  return `${URL_SCHEME}:`;
}

export function isEnsoDeepLink(url: string): boolean {
  return url.startsWith(`${URL_SCHEME}://`);
}
