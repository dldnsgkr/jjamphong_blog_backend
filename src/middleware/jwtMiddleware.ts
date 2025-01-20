import { Context, Next } from "koa";
import { verifyJWTToken } from "./../lib/jwtLib";

// JWT 토큰을 검증하는 미들웨어
async function jwtMiddleware(ctx: Context, next: Next) {
  // 예외를 두고 싶은 URL 및 메소드 설정
  const exemptPaths = [
    { method: "POST", path: "/login" }, // POST /login 경로는 JWT 검증 제외
  ];

  // 요청 메소드와 경로가 예외 목록에 포함되는지 확인
  const isExempt = exemptPaths.some(
    (exempt) => exempt.method === ctx.method && exempt.path === ctx.path
  );

  if (isExempt) {
    await next(); // 예외일 경우, JWT 검증을 건너뛰고 라우터로 이동
    return;
  }
  const token = ctx.headers.authorization?.split(" ")[1]; // Bearer token

  if (!token) {
    ctx.status = 400;
    ctx.body = { code: 400, message: "Token is required" };
    return;
  }

  const decoded = verifyJWTToken(ctx); // 기존의 verifyJWTToken 함수 사용
  if (!decoded) {
    ctx.status = 401;
    ctx.body = { code: 401, message: "Invalid or expired token" };
    return;
  }

  ctx.state.user = decoded; // 검증된 사용자 정보를 `ctx.state.user`에 저장
  await next(); // 이후의 미들웨어 또는 라우터로 처리 위임
}

export default jwtMiddleware;
