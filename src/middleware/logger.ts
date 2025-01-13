import { Context, Next } from "koa";

const logger = async (ctx: Context, next: Next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  console.log(`${ctx.method} ${ctx.url} - ${duration}ms`);
};

export default logger;
