import Router from "koa-router";
import promisePool from "./../db";

const usersRouter = new Router();

// 사용자 목록 가져오기
usersRouter.get("/", async (ctx) => {
  ctx.body = { users: ["Alice", "Bob", "Charlie"] };
});

// 특정 사용자 가져오기
usersRouter.get("/:id", async (ctx) => {
  const userId = ctx.params.id;
  try {
    const [rows, fields] = await promisePool.query(
      "SELECT * FROM `example_user_info`"
    );
    ctx.body = { code: 200, message: "success", contents: rows };
  } catch (error) {
    console.error("Database error:", error);
    ctx.status = 500;
    ctx.body = { error: "Failed to fetch user data from database" };
  }
});

export default usersRouter;
