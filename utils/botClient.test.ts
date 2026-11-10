import { describe, it, expect, vi } from 'vitest';
// Vive en electron/ porque lo usa el proceso principal; el test está aquí para
// que no se empaquete con la app.
import { fetchBotMovements, fetchBotBalance, settleBotMonth, parseBotBaseUrl, BOT_MAX_BYTES } from '../electron/botClient.js';

const TOKEN = 'token-de-prueba';

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Con la misma firma que fetch, para poder pasarlo como fetchImpl.
const fakeFetch = (impl: (url: string, init: RequestInit) => Promise<Response>) =>
  vi.fn((url: RequestInfo | URL, init?: RequestInit) => impl(String(url), init ?? {}));

describe('parseBotBaseUrl', () => {
  it('acepta http y https y añade la barra final', () => {
    expect(parseBotBaseUrl('http://127.0.0.1:8765')?.toString()).toBe('http://127.0.0.1:8765/');
    expect(parseBotBaseUrl(' https://nas.ejemplo.ts.net/bot ')?.toString()).toBe('https://nas.ejemplo.ts.net/bot/');
  });

  it.each(['ftp://127.0.0.1', 'file:///C:/datos', 'javascript:alert(1)', 'no es una url', '', 'http://user:pw@127.0.0.1'])(
    'rechaza %s', (raw) => {
      expect(parseBotBaseUrl(raw)).toBeNull();
    },
  );
});

describe('fetchBotMovements', () => {
  it('envía el token solo en la cabecera y no sigue redirecciones', async () => {
    const fetchImpl = fakeFetch(async () => jsonResponse(200, { movimientos: [] }));
    const result = await fetchBotMovements('http://127.0.0.1:8765/?x=1', TOKEN, { fetchImpl });

    expect(result).toEqual({ ok: true, body: { movimientos: [] } });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:8765/api/movimientos');
    expect(url).not.toContain(TOKEN);
    expect((init!.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
    expect(init!.redirect).toBe('error');
  });

  it.each([
    [401, 'unauthorized'],
    [403, 'unauthorized'],
    [500, 'server'],
    [503, 'server'],
    [404, 'not-found'],
  ])('HTTP %i → %s', async (status, error) => {
    const fetchImpl = fakeFetch(async () => jsonResponse(status, { error: 'x' }));
    expect(await fetchBotMovements('http://127.0.0.1:8765', TOKEN, { fetchImpl })).toEqual({ ok: false, error });
  });

  it('sin conexión (bot apagado) → offline', async () => {
    const fetchImpl = fakeFetch(async () => {
      throw new TypeError('fetch failed');
    });
    expect(await fetchBotMovements('http://127.0.0.1:8765', TOKEN, { fetchImpl })).toEqual({ ok: false, error: 'offline' });
  });

  it('sin respuesta a tiempo → timeout', async () => {
    const fetchImpl = fakeFetch((_url, init) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    }));
    const result = await fetchBotMovements('http://127.0.0.1:8765', TOKEN, { fetchImpl, timeoutMs: 20 });
    expect(result).toEqual({ ok: false, error: 'timeout' });
  });

  it('respuesta que no es JSON → invalid', async () => {
    const fetchImpl = fakeFetch(async () => new Response('<html>hola</html>', { status: 200 }));
    expect(await fetchBotMovements('http://127.0.0.1:8765', TOKEN, { fetchImpl })).toEqual({ ok: false, error: 'invalid' });
  });

  it('respuesta demasiado grande → too-large', async () => {
    const big = new Uint8Array(BOT_MAX_BYTES + 1);
    const fetchImpl = fakeFetch(async () => new Response(big, { status: 200 }));
    expect(await fetchBotMovements('http://127.0.0.1:8765', TOKEN, { fetchImpl })).toEqual({ ok: false, error: 'too-large' });
  });

  it('no hace la petición si la URL o el token no son válidos', async () => {
    const fetchImpl = fakeFetch(async () => jsonResponse(200, {}));
    expect(await fetchBotMovements('ftp://127.0.0.1', TOKEN, { fetchImpl })).toEqual({ ok: false, error: 'bad-url' });
    expect(await fetchBotMovements('http://127.0.0.1:8765', '', { fetchImpl })).toEqual({ ok: false, error: 'unauthorized' });
    expect(await fetchBotMovements('http://127.0.0.1:8765', 'con\nsalto', { fetchImpl })).toEqual({ ok: false, error: 'unauthorized' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('fetchBotBalance', () => {
  it('pide /api/balance con el token en la cabecera', async () => {
    const fetchImpl = fakeFetch(async () => jsonResponse(200, { meses: [] }));
    const result = await fetchBotBalance('http://127.0.0.1:8765', TOKEN, { fetchImpl });
    expect(result).toEqual({ ok: true, body: { meses: [] } });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:8765/api/balance');
    expect((init!.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
    expect(init!.redirect).toBe('error');
  });

  it('traduce los mismos errores que los movimientos', async () => {
    const fetchImpl = fakeFetch(async () => jsonResponse(401, { error: 'x' }));
    expect(await fetchBotBalance('http://127.0.0.1:8765', TOKEN, { fetchImpl })).toEqual({ ok: false, error: 'unauthorized' });
  });
});

describe('settleBotMonth', () => {
  it('hace POST con el mes en JSON, el token en la cabecera y sin seguir redirecciones', async () => {
    const fetchImpl = fakeFetch(async () => jsonResponse(201, { settlement: {}, month: {} }));
    const result = await settleBotMonth('http://127.0.0.1:8765', TOKEN, '2026-10', { fetchImpl });

    expect(result).toEqual({ ok: true, body: { settlement: {}, month: {} } });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:8765/api/liquidaciones');
    expect(url).not.toContain(TOKEN);
    expect(init!.method).toBe('POST');
    expect(JSON.parse(init!.body as string)).toEqual({ month: '2026-10' }); // nunca un importe
    const headers = init!.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(headers['Content-Type']).toBe('application/json');
    expect(init!.redirect).toBe('error');
  });

  it.each([
    [409, 'already-settled'],
    [400, 'rejected'],
    [401, 'unauthorized'],
    [404, 'not-found'],
    [500, 'server'],
    [200, 'invalid'], // al saldar solo vale 201
  ])('HTTP %i → %s', async (status, error) => {
    const fetchImpl = fakeFetch(async () => jsonResponse(status, { error: 'x' }));
    expect(await settleBotMonth('http://127.0.0.1:8765', TOKEN, '2026-10', { fetchImpl })).toEqual({ ok: false, error });
  });

  it.each(['octubre', '2026-13', '2026-1', '', null, '2026-10; DROP'])('no envía nada con el mes %s', async (month) => {
    const fetchImpl = fakeFetch(async () => jsonResponse(201, {}));
    expect(await settleBotMonth('http://127.0.0.1:8765', TOKEN, month as string, { fetchImpl })).toEqual({ ok: false, error: 'rejected' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('las lecturas siguen siendo GET', async () => {
    const fetchImpl = fakeFetch(async () => jsonResponse(200, { meses: [] }));
    await fetchBotBalance('http://127.0.0.1:8765', TOKEN, { fetchImpl });
    expect(fetchImpl.mock.calls[0][1]!.method).toBe('GET');
    expect(fetchImpl.mock.calls[0][1]!.body).toBeUndefined();
  });
});
