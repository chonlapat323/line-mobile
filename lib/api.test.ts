import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { api, saveToken, clearToken, getStoredUser, API_URL } from './api';

const mockFetch = jest.fn();
global.fetch = mockFetch;

// ─────────────────────────────────────────────
// helper
// ─────────────────────────────────────────────

function makeResponse(body: unknown, ok = true, status = 200, statusText = 'OK') {
  return {
    ok,
    status,
    statusText,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

beforeEach(() => {
  jest.clearAllMocks();
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
});

// ─────────────────────────────────────────────
// api.login — สำเร็จ
// ─────────────────────────────────────────────

describe('api.login — สำเร็จ', () => {
  it('คืน token และ user object', async () => {
    const payload = { token: 'jwt.abc', user: { id: '1', email: 'a@b.com', fullName: 'Test', role: 'user' } };
    mockFetch.mockResolvedValue(makeResponse(payload));

    const result = await api.login('a@b.com', 'pass123');

    expect(result).toEqual(payload);
  });

  it('ส่ง POST ไปยัง /auth/login', async () => {
    mockFetch.mockResolvedValue(makeResponse({ token: 't', user: {} }));

    await api.login('a@b.com', 'pass');

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/auth/login`);
    expect(opts.method).toBe('POST');
  });

  it('ส่ง email และ password ใน body', async () => {
    mockFetch.mockResolvedValue(makeResponse({ token: 't', user: {} }));

    await api.login('sales@beautyup.com', 'mypassword');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({ email: 'sales@beautyup.com', password: 'mypassword' });
  });

  it('ส่ง Content-Type: application/json', async () => {
    mockFetch.mockResolvedValue(makeResponse({ token: 't', user: {} }));

    await api.login('a@b.com', 'pass');

    expect(mockFetch.mock.calls[0][1].headers['Content-Type']).toBe('application/json');
  });

  it('login request ไม่มี Authorization (ยังไม่มี token ใน SecureStore)', async () => {
    mockFetch.mockResolvedValue(makeResponse({ token: 't', user: {} }));

    await api.login('a@b.com', 'pass');

    expect(mockFetch.mock.calls[0][1].headers['Authorization']).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// api.login — ล้มเหลว
// ─────────────────────────────────────────────

describe('api.login — ล้มเหลว', () => {
  it('server ตอบ 400 พร้อม message → throw Error พร้อมข้อความ', async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }, false, 400, 'Bad Request'),
    );

    await expect(api.login('a@b.com', 'wrong')).rejects.toThrow('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  });

  it('server ตอบ 500 ไม่มี JSON body → throw Error ด้วย statusText', async () => {
    const badRes = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: jest.fn().mockRejectedValue(new SyntaxError('not json')),
    } as unknown as Response;
    mockFetch.mockResolvedValue(badRes);

    await expect(api.login('a@b.com', 'pass')).rejects.toThrow('Internal Server Error');
  });
});

// ─────────────────────────────────────────────
// 401 auto-logout
// ─────────────────────────────────────────────

describe('401 auto-logout', () => {
  it('ลบ token ออกจาก SecureStore', async () => {
    mockFetch.mockResolvedValue(makeResponse({}, false, 401, 'Unauthorized'));

    await expect(api.getMe()).rejects.toThrow('Unauthorized');

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('user');
  });

  it('redirect ไปหน้า /login', async () => {
    mockFetch.mockResolvedValue(makeResponse({}, false, 401, 'Unauthorized'));

    await expect(api.getMe()).rejects.toThrow();

    expect(router.replace).toHaveBeenCalledWith('/login');
  });
});

// ─────────────────────────────────────────────
// Timeout
// ─────────────────────────────────────────────

describe('timeout', () => {
  it('AbortError → throw "การเชื่อมต่อหมดเวลา..."', async () => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    mockFetch.mockRejectedValue(err);

    await expect(api.login('a@b.com', 'pass')).rejects.toThrow('การเชื่อมต่อหมดเวลา');
  });
});

// ─────────────────────────────────────────────
// Network error
// ─────────────────────────────────────────────

describe('network error', () => {
  it('TypeError "Network request failed" → throw "ไม่สามารถเชื่อมต่อ..."', async () => {
    const err = new TypeError('Network request failed');
    mockFetch.mockRejectedValue(err);

    await expect(api.login('a@b.com', 'pass')).rejects.toThrow('ไม่สามารถเชื่อมต่อ');
  });
});

// ─────────────────────────────────────────────
// Authorization header injection
// ─────────────────────────────────────────────

describe('Authorization header', () => {
  it('มี token ใน SecureStore → ส่ง Bearer token', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('my.jwt.token');
    mockFetch.mockResolvedValue(makeResponse({}));

    await api.getMe();

    expect(mockFetch.mock.calls[0][1].headers['Authorization']).toBe('Bearer my.jwt.token');
  });

  it('ไม่มี token ใน SecureStore → ไม่มี Authorization header', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    mockFetch.mockResolvedValue(makeResponse({}));

    await api.getMe();

    expect(mockFetch.mock.calls[0][1].headers['Authorization']).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// api.getMyCommission
// ─────────────────────────────────────────────

describe('api.getMyCommission', () => {
  it('ส่ง GET ไปยัง URL พร้อม month query param', async () => {
    mockFetch.mockResolvedValue(makeResponse({ commission: 300 }));

    await api.getMyCommission('2026-06');

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(`${API_URL}/visits/my-commission?month=2026-06`);
  });

  it('คืน commission data จาก server', async () => {
    const data = { totalAmount: 10000, commission: 300, reachedThreshold: true, remaining: 0 };
    mockFetch.mockResolvedValue(makeResponse(data));

    const result = await api.getMyCommission('2026-06');

    expect(result).toEqual(data);
  });

  it('month ต่างกัน → URL ต่างกัน', async () => {
    mockFetch.mockResolvedValue(makeResponse({}));
    await api.getMyCommission('2026-05');
    expect(mockFetch.mock.calls[0][0]).toContain('month=2026-05');

    mockFetch.mockResolvedValue(makeResponse({}));
    await api.getMyCommission('2026-06');
    expect(mockFetch.mock.calls[1][0]).toContain('month=2026-06');
  });
});

// ─────────────────────────────────────────────
// saveToken / clearToken / getStoredUser
// ─────────────────────────────────────────────

describe('saveToken', () => {
  it('บันทึก token และ user ลง SecureStore', async () => {
    const user = { id: '1', email: 'a@b.com', fullName: 'Test', role: 'user' };

    await saveToken('jwt.token', user);

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('token', 'jwt.token');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('user', JSON.stringify(user));
  });
});

describe('clearToken', () => {
  it('ลบ token และ user ออกจาก SecureStore', async () => {
    await clearToken();

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('user');
  });
});

describe('getStoredUser', () => {
  it('คืน user object เมื่อมีข้อมูลใน SecureStore', async () => {
    const user = { id: '1', email: 'a@b.com', fullName: 'Test', role: 'user' };
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(user));

    const result = await getStoredUser();

    expect(result).toEqual(user);
  });

  it('คืน null เมื่อ SecureStore ว่างเปล่า', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

    const result = await getStoredUser();

    expect(result).toBeNull();
  });
});
