import Router from "koa-router";
import usersRouter from "./users";
import authRouter from "./auth";
import { swaggerSpec } from "../swagger";
import { koaSwagger } from "koa2-swagger-ui";

const router = new Router();

router.get(
  "/swagger",
  koaSwagger({
    routePrefix: false,
    swaggerOptions: {
      spec: swaggerSpec,
    },
  }),
);

// 기본 라우트
router.get("/", async (ctx) => {
  ctx.body = { message: "Welcome to the Koa TypeScript backend!" };
});

// 사용자 라우트 추가
router.use(usersRouter.routes(), usersRouter.allowedMethods());
router.use(authRouter.routes(), authRouter.allowedMethods());

export default router;
