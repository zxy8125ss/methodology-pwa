/** 简单 Bearer Token 鉴权 —— 常数时间比较，避免时序侧信道 */

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export interface AuthResult {
  ok: boolean;
  reason?: string;
}

/**
 * 若配置了 APP_TOKEN 则强制校验；未配置时放行（本地开发场景）。
 * 生产环境务必配置 APP_TOKEN。
 */
export function authorize(request: Request, expectedToken: string): AuthResult {
  if (!expectedToken) return { ok: true };

  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) {
    return { ok: false, reason: '缺少访问令牌' };
  }
  if (!timingSafeEqual(match[1].trim(), expectedToken)) {
    return { ok: false, reason: '访问令牌无效' };
  }
  return { ok: true };
}
