import app from "./index";

console.log("server");

const PORT = process.env.PORT;

app.use(async (ctx) => {
  ctx.body = {
    port: process.env.PORT,
    secret: process.env.JWT_SECRET,
  };
});

// TODO: HTTPS로 연결 하는 작업 필요
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
