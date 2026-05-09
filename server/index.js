const express = require('express');
const path = require('path');
const app = express();

// 端口必须这样写，Railway 才能用
const PORT = process.env.PORT || 3000;

// 自动返回首页 → 解决 Cannot GET /
app.get('/', (req, res) => {
  res.send('<h1>项目启动成功！</h1>');
});

// 监听 0.0.0.0 必须写
app.listen(PORT, '0.0.0.0', () => {
  console.log('服务已启动');
});