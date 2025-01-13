import { Context, Next } from "koa";

type CustomError = {
  status?: number;
} & Error;

const errorHandler = async (ctx: Context, next: Next) => {
  try {
    await next();
  } catch (err) {
    const error = err as CustomError;
    ctx.status = error.status || 500;
    ctx.body = { error: error.message || "Internal Server Error" };

    console.error("Error occurred:", error.message, error.stack);
  }
};

export default errorHandler;
