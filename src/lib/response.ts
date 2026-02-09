// src/lib/response.ts
import type { Context } from "koa";

export const successResponse = <T>(
  ctx: Context,
  contents?: T,
  message = "success",
  code = 200,
) => {
  ctx.status = code;
  ctx.body = {
    success: true,
    code,
    message,
    contents,
  };
};

export const failureResponse = (
  ctx: Context,
  message: string,
  code = 400,
  errors?: unknown,
) => {
  ctx.status = code;
  ctx.body = {
    success: false,
    code,
    message,
    errors,
  };
};
