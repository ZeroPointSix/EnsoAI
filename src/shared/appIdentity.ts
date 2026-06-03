/**
 * Production app identity (main branch). Dev channel uses dev branch appIdentity overrides.
 */
export const BUILD_CHANNEL = 'production' as const;

export const APP_USER_MODEL_ID = 'com.ensoaiplus.app';

export const URL_SCHEME = 'enso';

export const PRODUCT_NAME = 'EnsoAIPlus';

export const USER_DATA_DIR_NAME = 'EnsoAIPlus';

export const IDE_BRIDGE_NAME = 'EnsoAIPlus';

export function ensoProtocolPrefix(): string {
  return `${URL_SCHEME}:`;
}

export function isEnsoDeepLink(url: string): boolean {
  return url.startsWith(`${URL_SCHEME}://`);
}
