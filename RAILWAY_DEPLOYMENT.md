# Railway 部署指南

## 前置要求

1. Railway 账号
2. GitHub 账号
3. 代码已推送到 GitHub

## 部署步骤

### 1. 准备项目

确保项目结构如下：

```
/
├── server/          # Express 后端
│   ├── src/
│   ├── package.json
│   ├── railway.json
│   └── database/
│       └── init.sql
└── client/          # Expo 前端
```

### 2. 部署后端到 Railway

1. 登录 Railway
2. 点击 "New Project" -> "Deploy from GitHub repo"
3. 选择你的仓库
4. Railway 会自动识别 `railway.json` 配置
5. 点击 "Deploy"

Railway 会自动：
- 启动 PostgreSQL 数据库插件
- 执行 `server/database/init.sql` 初始化数据库
- 启动 Express 服务器

### 3. 获取 Railway 域名

部署完成后，Railway 会分配一个域名，例如：
```
https://your-app.up.railway.app
```

### 4. 配置前端 API 地址

将前端代码中的 `EXPO_PUBLIC_BACKEND_BASE_URL` 环境变量更新为 Railway 域名。

有两种方式：

#### 方式一：修改 EAS 配置（推荐）

编辑 `client/eas.json`：

```json
{
  "build": {
    "development": {
      "env": {
        "EXPO_PUBLIC_BACKEND_BASE_URL": "https://your-app.up.railway.app"
      }
    },
    "preview": {
      "env": {
        "EXPO_PUBLIC_BACKEND_BASE_URL": "https://your-app.up.railway.app"
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_BACKEND_BASE_URL": "https://your-app.up.railway.app"
      }
    }
  }
}
```

#### 方式二：使用 EAS 环境变量

```bash
eas build --profile production --env EXPO_PUBLIC_BACKEND_BASE_URL=https://your-app.up.railway.app
```

### 5. 构建 APK

```bash
cd client
eas build --platform android --profile production
```

## Railway 环境变量配置

Railway 会自动注入 `DATABASE_URL` 环境变量，你还需要设置：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `DATABASE_URL` | 数据库连接字符串（自动注入） | `postgresql://postgres:xxx@containers-us-west-xxx.railway.app:xxx/railway` |
| `PORT` | 服务器端口 | `9091` |
| `NODE_ENV` | 运行环境 | `production` |
| `ADMIN_PASSWORD` | 管理员密码 | `your_secure_password` |

## 验证部署

1. 测试健康检查接口：
```bash
curl https://your-app.up.railway.app/api/v1/health
```

2. 测试用户状态接口：
```bash
curl -H "x-device-id: test-device-123" https://your-app.up.railway.app/api/v1/user/status
```

## 常见问题

### 数据库连接失败

检查 `DATABASE_URL` 是否正确配置，Railway 应该会自动注入。

### 404 错误

检查 `railway.json` 中的 root 路径是否正确，应该指向 `server/` 目录。

### 前端无法连接后端

确保：
1. 前端的 `EXPO_PUBLIC_BACKEND_BASE_URL` 已更新为正确的 Railway 域名
2. 后端 API 路径正确，包含 `/api/v1` 前缀
3. 后端服务正常运行

## 管理员接口

使用管理员密码访问管理接口：

```bash
# 获取订单列表
curl -H "Authorization: Bearer your_admin_password" https://your-app.up.railway.app/api/v1/admin/orders

# 审核订单
curl -X POST -H "Authorization: Bearer your_admin_password" \
     -H "Content-Type: application/json" \
     -d '{"approved": true, "note": "审核通过"}' \
     https://your-app.up.railway.app/api/v1/admin/order/ORDER_ID/review
```

## 数据库管理

Railway 提供了内置的数据库管理界面：

1. 进入 Railway 项目
2. 点击 PostgreSQL 数据库
3. 点击 "Query" 按钮打开 SQL 查询界面

常用查询：

```sql
-- 查看所有用户状态
SELECT * FROM user_states ORDER BY created_at DESC;

-- 查看所有订单
SELECT * FROM orders ORDER BY created_at DESC;

-- 查看待审核订单
SELECT * FROM orders WHERE status = 'pending';

-- 查看订单统计
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
  SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
  SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
FROM orders;
```

## 备份与恢复

Railway PostgreSQL 自动提供每日备份。如需手动备份：

1. 进入 PostgreSQL 数据库页面
2. 点击 "Backups" 标签
3. 可以下载备份文件或恢复到任意时间点

## 监控与日志

Railway 提供实时日志监控：

1. 进入项目页面
2. 点击服务名称
3. 点击 "Logs" 标签查看实时日志

可以过滤日志级别（INFO, WARN, ERROR）和搜索关键字。
