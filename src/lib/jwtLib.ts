import JWT from "jsonwebtoken";
import Koa from "koa";

// 사용자 정보
const accessKey = process.env.JWT_ACCESS_KEY as string;

const refreshKey = process.env.JWT_REFRESH_KEY as string;

/**
 * JWT 토큰 발급
 */
export function signJWTToken(userData: any) {
  const accessToken = JWT.sign(userData, accessKey, { expiresIn: "15m" });

  const refreshToken = JWT.sign(userData, refreshKey, { expiresIn: "7d" });

  console.log(accessToken, refreshToken);

  return { accessToken, refreshToken };
}

/**
 * JWT 토큰 검증
 */
export function verifyJWTToken(ctx: Koa.Context) {
  try {
    // 들어온 요청 header에 token 값이 없는 경우
    const token = ctx.headers.authorization?.split(" ")[1];
    if (!token) {
      ctx.status = 400; // Unauthorized 상태 코드
      ctx.body = {
        code: 400,
        message: "Token is required",
        contents: "",
      };
      return;
    } else {
      // decoded의 값이 유효한 token이 아닌 경우
      const decoded = JWT.verify(token, accessKey);
      return decoded;
    }
  } catch (err) {
    ctx.status = 401; // Unauthorized 상태 코드
    ctx.body = {
      code: 401,
      message: "Invalid or expired token",
      contents: err,
    };
    return err; // 유효하지 않거나 만료된 경우
  }
}

/**
 * JWT 토큰 재발급
 */
export function refreshAccessToken(refreshToken: string) {
  try {
    // Refresh token 검증
    const decoded = JWT.verify(refreshToken, refreshToken);

    // 새 Access token 발급
    const newAccessToken = JWT.sign(decoded, accessKey, { expiresIn: "15m" });

    return newAccessToken;
  } catch (err) {
    return null; // Refresh token이 유효하지 않거나 만료된 경우
  }
}
