import Koa from "koa";
import bodyParser from "koa-bodyparser";
import logger from "./middleware/logger";
import router from "./routes";
import cors from "@koa/cors";
import errorHandler from "./middleware/errorHandler";

console.log("index");
const app = new Koa();

// 미들웨어 등록
app.use(errorHandler);
app.use(cors());
app.use(logger);
app.use(bodyParser());
app.use(router.routes());
app.use(router.allowedMethods());

export default app;
