import type { FileSearchResult } from '@shared/types/search';
import { toastManager } from '@/components/ui/toast';

export const CANVAS_MAX_IMAGES = 5;
export const CANVAS_MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export function extractMentionQuery(text: string, cursorPos: number): string | null {
  for (let i = cursorPos - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === '@') return text.slice(i + 1, cursorPos);
    if (ch === ' ' || ch === '\n' || ch === '\r') return null;
  }
  return null;
}

export function insertMentionAtCursor(
  content: string,
  cursor: number,
  item: FileSearchResult
): { nextContent: string; nextCursor: number } {
  let atPos = -1;
  for (let i = cursor - 1; i >= 0; i--) {
    if (content[i] === '@') {
      atPos = i;
      break;
    }
    if (content[i] === ' ' || content[i] === '\n') break;
  }
  if (atPos === -1) {
    return { nextContent: content, nextCursor: cursor };
  }
  const replacement = `@${item.relativePath} `;
  const nextContent = content.slice(0, atPos) + replacement + content.slice(cursor);
  return { nextContent, nextCursor: atPos + replacement.length };
}

function getImageExtension(file: File): string {
  const mime = file.type.toLowerCase();
  const mimeMap: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
    'image/svg+xml': 'svg',
  };
  const mapped = mimeMap[mime];
  if (mapped) return mapped;

  const name = file.name;
  const lastDot = name.lastIndexOf('.');
  if (lastDot > 0 && lastDot < name.length - 1) {
    const ext = name.slice(lastDot + 1).toLowerCase();
    if (/^[a-z0-9]{1,10}$/.test(ext)) {
      return ext;
    }
  }
  return 'png';
}

export async function saveCanvasInputImageToTemp(
  file: File,
  t: (key: string, params?: Record<string, string | number>) => string
): Promise<string | null> {
  if (file.size > CANVAS_MAX_IMAGE_SIZE) {
    toastManager.add({
      type: 'warning',
      title: t('Image too large'),
      description: t('Max image size is {{size}}MB', { size: 10 }),
    });
    return null;
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const filename = `ensoai-input-${timestamp}-${random}.${getImageExtension(file)}`;
    const result = await window.electronAPI.file.saveToTemp(filename, buffer);
    if (result.success && result.path) {
      return result.path;
    }
    toastManager.add({
      type: 'error',
      title: t('Failed to save image'),
      description: result.error || t('Unknown error'),
    });
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toastManager.add({
      type: 'error',
      title: t('Failed to save image'),
      description: message,
    });
    return null;
  }
}

export function isClaudeCanvasAgent(agentId: string | undefined): boolean {
  if (!agentId) return false;
  const base = agentId.endsWith('-hapi')
    ? agentId.slice(0, -5)
    : agentId.endsWith('-happy')
      ? agentId.slice(0, -6)
      : agentId;
  return base === 'claude';
}
