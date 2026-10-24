// Cliente de la API de solo lectura del bot de gastos (GET /api/movimientos).
//
// Se ejecuta en el proceso principal. El token va solo en la cabecera
// Authorization: nunca en la URL ni en los logs. No depende de Electron para
// poder probarlo con tests (utils/botClient.test.ts).

export const BOT_TIMEOUT_MS = 10_000;
// Unos años de movimientos ocupan pocos cientos de KB: algo mucho mayor no es el bot.
export const BOT_MAX_BYTES = 20 * 1024 * 1024; // 20 MB

// Devuelve la URL base validada (solo http/https, sin usuario ni contraseña) o null.
export const parseBotBaseUrl = (raw) => {
    if (typeof raw !== 'string' || raw.length > 500) return null;
    let url;
    try {
        url = new URL(raw.trim());
    } catch {
        return null;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    url.search = '';
    url.hash = '';
    // Con barra final, la ruta de la API se añade a la base (útil si un día va tras un proxy).
    if (!url.pathname.endsWith('/')) url.pathname += '/';
    return url;
};

// Solo caracteres ASCII visibles: evita inyectar otras cabeceras.
const isValidToken = (token) =>
    typeof token === 'string' && token.length > 0 && token.length <= 512 && /^[\x21-\x7e]+$/.test(token);

// Lee el cuerpo sin pasar de `max` bytes (no se fía de Content-Length).
const readLimited = async (res, max) => {
    const declared = Number(res.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > max) return null;
    if (!res.body) return '';
    const reader = res.body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > max) {
            await reader.cancel().catch(() => {});
            return null;
        }
        chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
};

const isTimeout = (error) => error?.name === 'TimeoutError';

// Resultado: { ok: true, body } o { ok: false, error } con error en
// 'bad-url' | 'unauthorized' | 'offline' | 'timeout' | 'server' | 'invalid' | 'too-large'.
export const fetchBotMovements = async (rawUrl, token, { fetchImpl = fetch, timeoutMs = BOT_TIMEOUT_MS } = {}) => {
    const base = parseBotBaseUrl(rawUrl);
    if (!base) return { ok: false, error: 'bad-url' };
    if (!isValidToken(token)) return { ok: false, error: 'unauthorized' };

    const signal = AbortSignal.timeout(timeoutMs);
    let res;
    try {
        res = await fetchImpl(new URL('api/movimientos', base).toString(), {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            // No seguir redirecciones: el token no debe acabar en otro servidor.
            redirect: 'error',
            cache: 'no-store',
            signal,
        });
    } catch (error) {
        return { ok: false, error: isTimeout(error) ? 'timeout' : 'offline' };
    }

    if (res.status === 401 || res.status === 403) return { ok: false, error: 'unauthorized' };
    if (res.status >= 500) return { ok: false, error: 'server' };
    if (res.status !== 200) return { ok: false, error: 'invalid' };

    let text;
    try {
        text = await readLimited(res, BOT_MAX_BYTES);
    } catch (error) {
        return { ok: false, error: isTimeout(error) ? 'timeout' : 'offline' };
    }
    if (text === null) return { ok: false, error: 'too-large' };

    try {
        return { ok: true, body: JSON.parse(text) };
    } catch {
        return { ok: false, error: 'invalid' };
    }
};
