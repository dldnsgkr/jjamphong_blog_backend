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
 * @swagger
 * /auth/signup:
 *   post:
 *     summary: 회원가입
 *     description: provider_id, email, password를 이용하여 회원가입을 진행합니다.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - provider_id
 *               - email
 *               - password
 *             properties:
 *               provider_id:
 *                 type: string
 *                 example: user123
 *               email:
 *                 type: string
 *                 format: email
 *                 example: test@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Password123!
 *     responses:
 *       201:
 *         description: 회원가입 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 회원가입 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     temporaryNickname:
 *                       type: string
 *                       example: user_ab12c
 *       400:
 *         description: 필수값 누락
 *       409:
 *         description: 이메일 또는 아이디 중복
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
 * @swagger
 * /auth/login:
 *   post:
 *     summary: 로그인
 *     description: provider_id와 password로 로그인합니다.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - provider_id
 *               - password
 *             properties:
 *               provider_id:
 *                 type: string
 *                 example: user123
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Password123!
 *     responses:
 *       200:
 *         description: 로그인 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 로그인 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *                     user:
 *                       type: object
 *                       properties:
 *                         provider_id:
 *                           type: string
 *                         nickname:
 *                           type: string
 *       401:
 *         description: 아이디 또는 비밀번호 오류
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
 * @swagger
 * /auth/user/info:
 *   patch:
 *     summary: 회원 정보 수정
 *     description: 로그인한 사용자의 정보를 수정합니다.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nickname:
 *                 type: string
 *               provider_id:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: 프로필 업데이트 완료
 *       400:
 *         description: 수정할 필드 없음
 *       401:
 *         description: 인증 실패
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
 * @swagger
 * /auth/me:
 *   get:
 *     summary: 내 정보 조회
 *     description: 로그인한 사용자의 정보를 조회합니다.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 회원 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 email:
 *                   type: string
 *                 nickname:
 *                   type: string
 *                 provider:
 *                   type: string
 *                 provider_id:
 *                   type: string
 *                 blog_title:
 *                   type: string
 *                 profile_image_url:
 *                   type: string
 *       401:
 *         description: 인증 실패
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
