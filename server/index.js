// server 文件夹里的启动文件（比如 index.js / server.js）
const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});