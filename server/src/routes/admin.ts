import express, { type Request, type Response } from 'express';
import {
  getAllOrders,
  getPendingOrders,
  reviewOrder,
  getOrderStats,
  getMembershipDays,
  getOrder,
} from '../services/order';
import { activatePremium, getUserState, updateUserState } from '../middleware/usageLimit';

const router = express.Router();

// 简单的管理员密码（生产环境应使用数据库和加密）
const ADMIN_PASSWORD = 'voicebutler2024';

// 管理员认证中间件
function adminAuth(req: Request, res: Response, next: express.NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || authHeader !== `Bearer ${ADMIN_PASSWORD}`) {
    res.status(401).json({ error: '未授权访问' });
    return;
  }
  
  next();
}

/**
 * POST /api/v1/admin/login
 * 管理员登录
 * Body: { password: string }
 */
router.post('/login', (req: Request, res: Response) => {
  const { password } = req.body;

  if (password === ADMIN_PASSWORD) {
    res.json({ 
      success: true, 
      token: ADMIN_PASSWORD,
      message: '登录成功',
    });
  } else {
    res.status(401).json({ error: '密码错误' });
  }
});

/**
 * GET /api/v1/admin/orders
 * 获取所有订单（需要管理员权限）
 */
router.get('/orders', adminAuth, (req: Request, res: Response) => {
  const status = req.query.status as string;
  
  let orders;
  if (status === 'pending') {
    orders = getPendingOrders();
  } else {
    orders = getAllOrders();
  }
  
  res.json({ orders });
});

/**
 * GET /api/v1/admin/stats
 * 获取订单统计（需要管理员权限）
 */
router.get('/stats', adminAuth, (_req: Request, res: Response) => {
  const stats = getOrderStats();
  res.json(stats);
});

/**
 * POST /api/v1/admin/review/:id
 * 审核订单（需要管理员权限）
 * Body: { approved: boolean, note?: string }
 */
router.post('/review/:id', adminAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const orderId = Array.isArray(id) ? id[0] : id;
  const { approved, note } = req.body;

  if (typeof approved !== 'boolean') {
    return res.status(400).json({ error: '请指定审核结果' });
  }

  const order = getOrder(orderId);
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }

  if (order.status !== 'pending') {
    return res.status(400).json({ error: '该订单已被审核' });
  }

  // 审核订单
  const updatedOrder = reviewOrder(orderId, approved, note);
  
  // 如果通过审核，激活会员
  if (approved && updatedOrder) {
    const days = getMembershipDays(order.amount);
    if (days > 0) {
      activatePremium(order.deviceId, undefined, days);
    }
  }

  res.json({
    success: true,
    message: approved ? '订单已通过，会员已激活' : '订单已拒绝',
    order: updatedOrder,
  });
});

/**
 * POST /api/v1/admin/activate
 * 手动激活会员（需要管理员权限）
 * Body: { deviceId: string, days: number }
 */
router.post('/activate', adminAuth, (req: Request, res: Response) => {
  const { deviceId, days } = req.body;

  if (!deviceId) {
    return res.status(400).json({ error: '请提供设备ID' });
  }

  if (!days || days < 1) {
    return res.status(400).json({ error: '请提供有效的天数' });
  }

  activatePremium(deviceId, undefined, days);
  
  res.json({
    success: true,
    message: `已为设备 ${deviceId} 激活 ${days} 天会员`,
  });
});

/**
 * HTML管理页面
 */
router.get('/dashboard', (_req: Request, res: Response) => {
  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>语音管家 - 管理后台</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; min-height: 100vh; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #6C63FF, #896BFF); color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; }
    .header h1 { font-size: 24px; margin-bottom: 8px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px; }
    .stat-card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .stat-card h3 { font-size: 14px; color: #666; margin-bottom: 8px; }
    .stat-card .value { font-size: 28px; font-weight: bold; color: #333; }
    .login-form { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 400px; margin: 100px auto; }
    .login-form h2 { margin-bottom: 20px; color: #333; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; margin-bottom: 6px; color: #666; }
    .form-group input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 16px; }
    .btn { background: linear-gradient(135deg, #6C63FF, #896BFF); color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 16px; width: 100%; }
    .btn:hover { opacity: 0.9; }
    .btn-danger { background: #FF6584; }
    .btn-success { background: #4CAF50; }
    .orders-table { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .orders-table table { width: 100%; border-collapse: collapse; }
    .orders-table th, .orders-table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #eee; }
    .orders-table th { background: #f8f8f8; font-weight: 600; }
    .status-badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; }
    .status-pending { background: #FFF3E0; color: #FF9800; }
    .status-approved { background: #E8F5E9; color: #4CAF50; }
    .status-rejected { background: #FFEBEE; color: #F44336; }
    .actions { display: flex; gap: 8px; }
    .actions button { padding: 6px 12px; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; }
    .hidden { display: none; }
    .logout-btn { background: transparent; border: 1px solid white; color: white; padding: 8px 16px; border-radius: 6px; cursor: pointer; }
  </style>
</head>
<body>
  <div id="loginScreen">
    <div class="login-form">
      <h2>🔐 管理员登录</h2>
      <div class="form-group">
        <label>管理员密码</label>
        <input type="password" id="password" placeholder="请输入管理员密码" onkeypress="if(event.key==='Enter')login()">
      </div>
      <button class="btn" onclick="login()">登录</button>
      <p id="loginError" style="color: red; margin-top: 12px; text-align: center;"></p>
    </div>
  </div>

  <div id="dashboardScreen" class="container hidden">
    <div class="header">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1>🎯 语音管家管理后台</h1>
          <p>订单管理与会员激活</p>
        </div>
        <button class="logout-btn" onclick="logout()">退出登录</button>
      </div>
    </div>
    
    <div class="stats" id="statsContainer"></div>
    
    <div class="orders-table">
      <table>
        <thead>
          <tr>
            <th>订单ID</th>
            <th>设备ID</th>
            <th>支付方式</th>
            <th>金额</th>
            <th>交易单号</th>
            <th>备注</th>
            <th>状态</th>
            <th>提交时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody id="ordersBody"></tbody>
      </table>
    </div>
  </div>

  <script>
    let token = '';
    
    async function login() {
      const password = document.getElementById('password').value;
      const errorEl = document.getElementById('loginError');
      
      try {
        const res = await fetch('/api/v1/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const data = await res.json();
        
        if (data.success) {
          token = data.token;
          document.getElementById('loginScreen').classList.add('hidden');
          document.getElementById('dashboardScreen').classList.remove('hidden');
          loadData();
        } else {
          errorEl.textContent = data.error || '登录失败';
        }
      } catch (e) {
        errorEl.textContent = '网络错误，请重试';
      }
    }
    
    function logout() {
      token = '';
      document.getElementById('loginScreen').classList.remove('hidden');
      document.getElementById('dashboardScreen').classList.add('hidden');
    }
    
    async function loadData() {
      await Promise.all([loadStats(), loadOrders()]);
    }
    
    async function loadStats() {
      const res = await fetch('/api/v1/admin/stats', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const data = await res.json();
      
      document.getElementById('statsContainer').innerHTML = \`
        <div class="stat-card">
          <h3>总订单数</h3>
          <div class="value">\${data.total}</div>
        </div>
        <div class="stat-card">
          <h3>待审核</h3>
          <div class="value" style="color: #FF9800;">\${data.pending}</div>
        </div>
        <div class="stat-card">
          <h3>已通过</h3>
          <div class="value" style="color: #4CAF50;">\${data.approved}</div>
        </div>
        <div class="stat-card">
          <h3>总收入</h3>
          <div class="value" style="color: #6C63FF;">¥\${data.totalAmount.toFixed(2)}</div>
        </div>
      \`;
    }
    
    async function loadOrders() {
      const res = await fetch('/api/v1/admin/orders', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const data = await res.json();
      
      const tbody = document.getElementById('ordersBody');
      tbody.innerHTML = data.orders.map(order => \`
        <tr>
          <td><code>\${order.id}</code></td>
          <td><code>\${order.deviceId.substring(0, 8)}...</code></td>
          <td>\${order.paymentMethod === 'wechat' ? '微信' : '支付宝'}</td>
          <td>¥\${order.amount}</td>
          <td><code>\${order.transactionId}</code></td>
          <td>\${order.note || '-'}</td>
          <td>
            <span class="status-badge status-\${order.status}">
              \${order.status === 'pending' ? '待审核' : order.status === 'approved' ? '已通过' : '已拒绝'}
            </span>
          </td>
          <td>\${new Date(order.createdAt).toLocaleString()}</td>
          <td>
            \${order.status === 'pending' ? \`
              <div class="actions">
                <button class="btn-success" onclick="review('\${order.id}', true)">通过</button>
                <button class="btn-danger" onclick="review('\${order.id}', false)">拒绝</button>
              </div>
            \` : order.reviewedAt ? \`审核于 \${new Date(order.reviewedAt).toLocaleString()}\` : '-'}
          </td>
        </tr>
      \`).join('');
    }
    
    async function review(orderId, approved) {
      if (!confirm(approved ? '确认通过该订单？' : '确认拒绝该订单？')) return;
      
      const res = await fetch(\`/api/v1/admin/review/\${orderId}\`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ approved })
      });
      const data = await res.json();
      
      if (data.success) {
        alert(data.message);
        loadData();
      } else {
        alert(data.error || '操作失败');
      }
    }
  </script>
</body>
</html>
  `;
  
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

export default router;
