import Router from "koa-router";
import usersRouter from "./users";
import loginRouter from "./login";

const router = new Router();

// 기본 라우트
router.get("/", async (ctx) => {
  ctx.body = { message: "Welcome to the Koa TypeScript backend!" };
});

// 사용자 라우트 추가
router.use("/users", usersRouter.routes(), usersRouter.allowedMethods());
router.use("/login", loginRouter.routes(), loginRouter.allowedMethods());

export default router;
