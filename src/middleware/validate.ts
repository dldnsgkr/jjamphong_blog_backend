// middleware/validate.ts
import type { Context, Next } from "koa";
import { failureResponse } from "lib/response";
import { ZodSchema, ZodError } from "zod";

type ValidateTarget = "body" | "query" | "params";

export const validate =
  <T>(schema: ZodSchema<T>, target: ValidateTarget = "body") =>
  async (ctx: Context, next: Next) => {
    const data =
      target === "body"
        ? ctx.request.body
        : target === "query"
          ? ctx.request.query
          : ctx.params;

    const result = schema.safeParse(data);

    if (!result.success) {
      const error = result.error as ZodError;

      ctx.status = 400;
      failureResponse(
        ctx,
        "요청 파라미터가 올바르지 않습니다.",
        400,
        error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      );
      return;
    }

    // ✅ 검증 성공 → 값 교체
    if (target === "body") ctx.request.body = result.data;
    if (target === "query") ctx.request.query = result.data as any;
    if (target === "params") ctx.params = result.data as any;

    await next();
  };
