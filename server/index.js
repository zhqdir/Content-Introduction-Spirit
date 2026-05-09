const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('<h1>部署成功！项目正常运行!</h1>');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Server started on port', PORT);
});