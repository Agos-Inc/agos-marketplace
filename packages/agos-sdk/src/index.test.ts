import { describe, expect, it, vi } from 'vitest';
import { AgosSdkError, createAgosSdk } from './index.js';

describe('AgosSdk', () => {
  it('lists listings and creates purchase', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              listing_id: 'svc_demo_v1',
              listing_id_hex: '0x1',
              title: 'Demo',
              description: 'desc',
              price_usdt: '1.0',
              price_atomic: '1000000',
              token_decimals: 6,
              supplier_wallet: '0x0000000000000000000000000000000000000001',
              endpoint: 'http://localhost/task',
              version: '1.0.0',
              is_active: true
            }
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            purchase_id: 'ord_1',
            purchase_id_hex: '0x2',
            listing_id: 'svc_demo_v1',
            listing_id_hex: '0x1',
            buyer_wallet: '0x0000000000000000000000000000000000000002',
            supplier_wallet: '0x0000000000000000000000000000000000000001',
            amount_usdt: '1.0',
            amount_atomic: '1000000',
            token_decimals: 6,
            token_address: '0x0000000000000000000000000000000000000003',
            chain_id: 56,
            status: 'CREATED',
            tx_hash: null,
            error_message: null,
            result_payload: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }),
          { status: 201, headers: { 'content-type': 'application/json' } }
        )
      );

    const sdk = createAgosSdk({
      baseUrl: 'http://localhost:3000/',
      fetcher
    });

    const listings = await sdk.listListings();
    expect(listings[0]?.listing_id).toBe('svc_demo_v1');

    const purchase = await sdk.createPurchase({
      listing_id: 'svc_demo_v1',
      buyer_wallet: '0x0000000000000000000000000000000000000002',
      input_payload: { query: 'hello' }
    });
    expect(purchase.purchase_id).toBe('ord_1');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('throws AgosSdkError on non-2xx response', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ message: 'bad request' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      })
    );

    const sdk = createAgosSdk({
      baseUrl: 'http://localhost:3000',
      fetcher
    });

    await expect(sdk.getListing('missing')).rejects.toBeInstanceOf(AgosSdkError);
  });
});
