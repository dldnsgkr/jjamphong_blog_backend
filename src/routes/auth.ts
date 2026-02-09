import Router from "koa-router";
import bcrypt from "bcrypt";
import db from "../db"; // promisePool
import { signJWTToken } from "../lib/jwtLib";
import { LoginRequestDto, LoginSchema } from "@DTO/auth/login";
import { validate } from "@middleware/validate";
import { failureResponse, successResponse } from "lib/response";

const authRouter = new Router({ prefix: "/auth" });

/**
 * 회원가입 api
 */
authRouter.post("/signup", async (ctx) => {
  const { provider_id, email, password } = ctx.request.body as {
    provider_id: string;
    email: string;
    password: string;
  };

  /* 1. 필수값 체크 */
  if (!provider_id || !email || !password) {
    ctx.status = 400;
    ctx.body = {
      code: 400,
      message: "ID, email, password는 필수입니다",
    };
    return;
  }

  /* 2-1. 이메일 중복 체크 */
  const [emailUser] = await db.query(`SELECT id FROM users WHERE email = ?`, [
    email,
  ]);

  if ((emailUser as any[]).length > 0) {
    ctx.status = 409;
    ctx.body = {
      code: 409,
      message: "이미 가입된 이메일입니다",
    };
    return;
  }

  /* 2-2. provider_id 중복 체크 */
  const [providerUser] = await db.query(
    `SELECT id FROM users WHERE provider_id = ?`,
    [provider_id],
  );

  if ((providerUser as any[]).length > 0) {
    ctx.status = 409;
    ctx.body = {
      code: 409,
      message: "이미 사용 중인 아이디입니다",
    };
    return;
  }

  /* 3. 비밀번호 해싱 */
  const passwordHash = await bcrypt.hash(password, 10);

  /* 4. 사용자 저장 */

  const temporaryNickname = `user_${Math.random()
    .toString(36)
    .substring(2, 7)}`;

  await db.query(
    `
    INSERT INTO users (
      email,
      password_hash,
      provider,
      provider_id,
      nickname
    ) VALUES (?, ?, 'local', ?, ?)
    `,
    [email, passwordHash, provider_id, temporaryNickname],
  );

  /* 5. 응답 */
  successResponse(ctx, { temporaryNickname }, "회원가입 성공", 201);
});

/**
 * 로그인 api
 */
authRouter.post("/login", validate(LoginSchema), async (ctx) => {
  const { provider_id, password } = ctx.request.body as LoginRequestDto;

  const [rows] = await db.query(
    `
  SELECT id, password_hash, nickname
  FROM users
  WHERE provider_id = ?
  `,
    [provider_id],
  );

  const user = (rows as any[])[0];

  if (!user) {
    console.log(user);
    failureResponse(ctx, "아이디 또는 비밀번호가 올바르지 않습니다.", 401);
    return;
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);

  if (!isMatch) {
    failureResponse(ctx, "아이디 또는 비밀번호가 올바르지 않습니다.", 401);
    return;
  }

  const token = signJWTToken({
    userId: user.id,
    provider_id,
    nickname: user.nickname,
  });

  successResponse(
    ctx,
    {
      accessToken: token,
      user: {
        id: user.id,
        provider_id,
        nickname: user.nickname,
      },
    },
    "로그인 성공",
    200,
  );
});

export default authRouter;
