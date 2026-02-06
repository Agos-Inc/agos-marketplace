import crypto from 'node:crypto';
import type { OrderCallback } from '@agos/shared-types';

export function buildCallbackSignature(payload: OrderCallback, timestamp: string, nonce: string, secret: string): string {
  const body = JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${nonce}.${body}`).digest('hex');
}

export function buildSignedCallback(payload: OrderCallback, secret: string): {
  payload: OrderCallback;
  headers: Record<string, string>;
} {
  const timestamp = String(Date.now());
  const nonce = crypto.randomUUID();
  const signature = buildCallbackSignature(payload, timestamp, nonce, secret);

  return {
    payload,
    headers: {
      'x-callback-timestamp': timestamp,
      'x-callback-nonce': nonce,
      'x-callback-signature': signature
    }
  };
}
