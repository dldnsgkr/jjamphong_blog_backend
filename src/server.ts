import app from "./index";

console.log("server");

const PORT = process.env.PORT;

app.use(async (ctx) => {
  ctx.body = {
    port: process.env.PORT,
    secret: process.env.JWT_SECRET,
  };
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
