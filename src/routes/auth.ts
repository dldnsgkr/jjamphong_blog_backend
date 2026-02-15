import Router from "koa-router";
import bcrypt from "bcrypt";
import db from "../db"; // promisePool
import { signJWTToken } from "../lib/jwtLib";
import {
  LoginRequestDto,
  LoginSchema,
  SignupRequestDto,
  SignupSchema,
  UpdateProfileRequestDto,
  UpdateProfileSchema,
} from "@DTO/auth";
import { validate } from "@middleware/validate";
import { failureResponse, successResponse } from "lib/response";

const authRouter = new Router({ prefix: "/auth" });

/**
 * 회원가입 api
 */
authRouter.post("/signup", validate(SignupSchema), async (ctx) => {
  const { provider_id, email, password } = ctx.request.body as SignupRequestDto;

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

  const isProd = process.env.NODE_ENV === "production";

  ctx.cookies.set("refreshToken", token.refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
  });

  successResponse(
    ctx,
    {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      user: {
        // id: user.id,
        provider_id,
        nickname: user.nickname,
      },
    },
    "로그인 성공",
    200,
  );
});

/**
 * 회원 정보 수정 api
 */
authRouter.patch("/user/info", validate(UpdateProfileSchema), async (ctx) => {
  const {
    nickname,
    provider_id,
    password,
    socialInfo,
    // profileImage,
    // bio,
    // blogTitle,
    // allowCommentNotify,
    // allowBlogNotify,
  } = ctx.request.body as UpdateProfileRequestDto;

  const updateFields: string[] = [];
  const values: any[] = [];

  if (nickname !== undefined) {
    updateFields.push("nickname = ?");
    values.push(nickname);
  }

  if (provider_id !== undefined) {
    updateFields.push("provider_id = ?");
    values.push(provider_id);
  }

  if (password !== undefined) {
    updateFields.push("password_hash = ?");
    values.push(password);
  }

  // if (profileImage !== undefined) {
  //   updateFields.push("profile_image = ?");
  //   values.push(profileImage);
  // }

  // if (bio !== undefined) {
  //   updateFields.push("bio = ?");
  //   values.push(bio);
  // }

  // if (blogTitle !== undefined) {
  //   updateFields.push("blog_title = ?");
  //   values.push(blogTitle);
  // }

  // if (allowCommentNotify !== undefined) {
  //   updateFields.push("allow_comment_notify = ?");
  //   values.push(allowCommentNotify);
  // }

  // if (allowBlogNotify !== undefined) {
  //   updateFields.push("allow_blog_notify = ?");
  //   values.push(allowBlogNotify);
  // }

  if (updateFields.length === 0) {
    ctx.throw(400, "수정할 필드가 없습니다.");
  }

  const sql = `
    UPDATE users
    SET ${updateFields.join(", ")}
    WHERE id = ?
  `;

  values.push(ctx.state.user.id);

  await db.query(sql, values);

  successResponse(ctx, {}, "프로필 업데이트 완료", 200);
});

/**
 * 회원 정보 api
 */

authRouter.get("/me", async (ctx) => {
  const user = await db.query(
    `
      SELECT
        email,
        nickname,
        provider,
        provider_id,
        blog_title,
        profile_image_url,
      FROM users
      WHERE id = ?
      `,
    [ctx.state.user.id],
  );

  successResponse(ctx, user[0], "회원 정보 조회 성공", 200);
});

export default authRouter;
