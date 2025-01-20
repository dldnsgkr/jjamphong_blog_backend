import Router from "koa-router";
import { signJWTToken } from "./../lib/jwtLib";

const loginRouter = new Router();

/**
 * 로그인 api
 */
loginRouter.post("/", async (ctx) => {
  const body = ctx.request.body;
  signJWTToken(body);
  ctx.body = { code: 200, message: "success", contents: "wow" };
});

export default loginRouter;
