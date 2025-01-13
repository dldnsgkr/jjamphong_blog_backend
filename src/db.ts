import * as mysql from "mysql2";
import dotenv from "dotenv";

console.log("db");
const envFile = `.env.${process.env.NODE_ENV}`;
dotenv.config({ path: envFile });

const host = process.env.DB_HOST;
const port = parseInt(process.env.DB_PORT as string, 10);
const user = process.env.DB_USER;
const password = process.env.DB_PASSWORD;
const database = process.env.DB_DATABASE_NAME;

console.log({
  host,
  port,
  user,
  password,
  database,
});
const pool = mysql.createPool({
  host,
  port,
  user,
  password,
  database,
});

const promisePool = pool.promise();

export default promisePool;
