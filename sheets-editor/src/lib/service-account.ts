import fs from 'fs';
import path from 'path';

export function getServiceAccountKey(): object {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    } catch {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON');
    }
  }

  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  if (keyPath) {
    const absolutePath = path.resolve(process.cwd(), keyPath);
    if (fs.existsSync(absolutePath)) {
      const raw = fs.readFileSync(absolutePath, 'utf-8');
      return JSON.parse(raw);
    }
    throw new Error(`Service account key file not found: ${absolutePath}`);
  }

  throw new Error(
    'Google service account credentials not configured. Set GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SERVICE_ACCOUNT_KEY_PATH.'
  );
}
