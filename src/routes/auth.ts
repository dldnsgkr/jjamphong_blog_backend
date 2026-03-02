import Router from "koa-router";
import bcrypt from "bcrypt";
import JWT from "jsonwebtoken";
import db, { execute, query } from "../db"; // promisePool
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
import { RowDataPacket } from "mysql2";

/* ================================
   타입 정의
================================ */

interface IdRow extends RowDataPacket {
  id: number;
}

interface LoginUserRow extends RowDataPacket {
  id: number;
  password_hash: string;
  nickname: string;
}

interface UserRow extends RowDataPacket {
  provider_id: string;
  nickname: string;
}

interface MeRow extends RowDataPacket {
  email: string;
  nickname: string;
  provider: string;
  provider_id: string;
  blog_title: string;
  profile_image_url: string | null;
}

const authRouter = new Router({ prefix: "/auth" });

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: AccessToken 재발급
 *     description: httpOnly 쿠키에 저장된 refreshToken을 이용하여 accessToken을 재발급합니다.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: 토큰 재발급 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 토큰 재발급 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     user:
 *                       type: object
 *                       properties:
 *                         provider_id:
 *                           type: string
 *                           example: user123
 *                         nickname:
 *                           type: string
 *                           example: user_ab12c
 *       401:
 *         description: Refresh 토큰 없음 (쿠키에 없음)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 아이디 또는 비밀번호가 올바르지 않습니다.
 *       403:
 *         description: 유효하지 않거나 만료된 토큰
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 토큰 검증 실패
 *       404:
 *         description: 사용자를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 사용자를 찾을 수 없습니다.
 */
authRouter.post("/refresh", async (ctx) => {
  const oldToken = ctx.cookies.get("refreshToken");

  if (!oldToken)
    return failureResponse(
      ctx,
      "아이디 또는 비밀번호가 올바르지 않습니다.",
      401,
    );

  try {
    const decoded = JWT.verify(oldToken, process.env.JWT_REFRESH_KEY!) as {
      userId: string;
    };

    const tokenRows = await query<IdRow>(
      `
        SELECT user_id
        FROM refresh_tokens
        WHERE token = ?
          AND expires_at > NOW()
      `,
      [oldToken],
    );

    if (tokenRows.length === 0) {
      return failureResponse(ctx, "유효하지 않은 토큰입니다.", 403);
    }

    const userRows = await query<UserRow>(
      `
        SELECT provider_id, nickname
        FROM users
        WHERE id = ?
      `,
      [decoded.userId],
    );

    if (userRows.length === 0) {
      return failureResponse(ctx, "사용자를 찾을 수 없습니다.", 404);
    }

    const user = userRows[0];

    await execute(
      `
        DELETE FROM refresh_tokens
        WHERE token = ?
      `,
      [oldToken],
    );

    const token = signJWTToken({
      userId: decoded.userId,
    });

    await execute(
      `
        INSERT INTO refresh_tokens (user_id, token, created_at, expires_at)
        VALUES (?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY))
      `,
      [decoded.userId, token.refreshToken],
    );

    const isProd = process.env.NODE_ENV === "production";

    ctx.cookies.set("refreshToken", token.refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
    });

    return successResponse(
      ctx,
      {
        accessToken: token.accessToken,
        user: {
          provider_id: user.provider_id,
          nickname: user.nickname,
        },
      },
      "토큰 재발급 성공",
      200,
    );
  } catch {
    return failureResponse(ctx, "토큰 검증 실패", 403);
  }
});

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
  const [emailUser] = await query<IdRow>(
    `SELECT id FROM users WHERE email = ?`,
    [email],
  );

  if (emailUser.length > 0) {
    ctx.status = 409;
    ctx.body = {
      code: 409,
      message: "이미 가입된 이메일입니다",
    };
    return;
  }

  /* 2-2. provider_id 중복 체크 */
  const [providerUser] = await query<IdRow>(
    `SELECT id FROM users WHERE provider_id = ?`,
    [provider_id],
  );

  if (providerUser.length > 0) {
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

  await execute(
    `
    INSERT INTO users (
      email,
      password_hash,
      provider,
      provider_id,
      nickname,
      blog_title
    ) VALUES (?, ?, 'local', ?, ?, ?)
    `,
    [email, passwordHash, provider_id, temporaryNickname, temporaryNickname],
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

  const rows = await query<LoginUserRow>(
    `
  SELECT id, password_hash, nickname
  FROM users
  WHERE provider_id = ?
  `,
    [provider_id],
  );

  const user = rows[0];

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
  });

  const isProd = process.env.NODE_ENV === "production";

  ctx.cookies.set("refreshToken", token.refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
  });

  await execute(
    `
    INSERT INTO refresh_tokens (user_id, token, created_at, expires_at)
    VALUES (?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY))
  `,
    [user.id, token.refreshToken],
  );

  successResponse(
    ctx,
    {
      accessToken: token.accessToken,
      user: {
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
 * /auth/logout:
 *   post:
 *     summary: 로그아웃
 *     description: httpOnly 쿠키에 저장된 refreshToken을 삭제하여 로그아웃을 처리합니다.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: 로그아웃 완료
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 로그아웃 완료
 *                 data:
 *                   type: object
 *                   example: {}
 *       500:
 *         description: 서버 오류
 */
authRouter.post("/logout", async (ctx) => {
  const token = ctx.cookies.get("refreshToken");

  if (!token) {
    return successResponse(ctx, {}, "로그아웃 완료", 200);
  }

  await execute(
    `
      DELETE FROM refresh_tokens
      WHERE token = ?
    `,
    [token],
  );

  ctx.cookies.set("refreshToken", "", {
    httpOnly: true,
    maxAge: 0,
  });

  successResponse(ctx, {}, "로그아웃 완료", 200);
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
    userExplain,
    email,
    social_discord,
    social_facebook,
    social_github,
    social_instagram,
    social_phone,
    social_slack,
    // profileImage,
    // bio,
    blog_title,
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

  if (email !== undefined) {
    updateFields.push("email = ?");
    values.push(email);
  }

  if (social_discord !== undefined) {
    updateFields.push("social_discord = ?");
    values.push(social_discord);
  }

  if (social_facebook !== undefined) {
    updateFields.push("social_facebook = ?");
    values.push(social_facebook);
  }

  if (social_github !== undefined) {
    updateFields.push("social_github = ?");
    values.push(social_github);
  }

  if (social_instagram !== undefined) {
    updateFields.push("social_instagram = ?");
    values.push(social_instagram);
  }

  if (social_phone !== undefined) {
    updateFields.push("social_phone = ?");
    values.push(social_phone);
  }

  if (social_slack !== undefined) {
    updateFields.push("social_slack = ?");
    values.push(social_slack);
  }

  // if (profileImage !== undefined) {
  //   updateFields.push("profile_image = ?");
  //   values.push(profileImage);
  // }

  // if (bio !== undefined) {
  //   updateFields.push("bio = ?");
  //   values.push(bio);
  // }

  if (blog_title !== undefined) {
    updateFields.push("blog_title = ?");
    values.push(blog_title);
  }

  // if (allowCommentNotify !== undefined) {
  //   updateFields.push("allow_comment_notify = ?");
  //   values.push(allowCommentNotify);
  // }

  if (userExplain !== undefined) {
    updateFields.push("user_explain = ?");
    values.push(userExplain);
  }

  if (updateFields.length === 0) {
    ctx.throw(400, "수정할 필드가 없습니다.");
  }

  const sql = `
    UPDATE users
    SET ${updateFields.join(", ")}
    WHERE id = ?
  `;

  values.push(ctx.state.user.userId);

  await execute(sql, values);

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
  const rows = await query<MeRow>(
    `
      SELECT
        email,
        nickname,
        provider,
        provider_id,
        blog_title,
        profile_image_url,
        user_explain,
        social_instagram,
        social_slack,
        social_discord,
        social_github,
        social_phone,
        social_facebook
      FROM users
      WHERE id = ?
      `,
    [ctx.state.user.userId],
  );

  successResponse(ctx, rows[0], "회원 정보 조회 성공", 200);
});

export default authRouter;
