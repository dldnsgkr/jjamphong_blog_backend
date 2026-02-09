import * as mysql from "mysql2";
import dotenv from "dotenv";

console.log("db");
const NODE_ENV = process.env.NODE_ENV || "development";
dotenv.config({ path: `.env.${NODE_ENV}` });

const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_DATABASE_NAME } =
  process.env;

const pool = mysql.createPool({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_DATABASE_NAME,
  // 커넥션 없을 때 대기
  waitForConnections: true,
  // 동시 커넥션 제한
  connectionLimit: 10,
  // 요청 큐 제한(0 = 무제한)
  queueLimit: 0,
});

const promisePool = pool.promise();

export default promisePool;
