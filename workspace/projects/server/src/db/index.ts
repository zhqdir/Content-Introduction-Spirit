import pg from 'pg';
import * as memoryStore from './memory';

const { Pool } = pg;

let pool: pg.Pool | null = null;
let useMemoryStore = false;

/**
 * 初始化数据库连接
 */
export async function initializeDatabase(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.warn('DATABASE_URL 环境变量未设置，使用内存存储模式（仅用于开发环境）');
    useMemoryStore = true;
    return;
  }

  try {
    pool = new Pool({
      connectionString: databaseUrl,
    });

    // 测试连接
    await pool.query('SELECT 1');
    console.log('数据库连接成功');

    // 初始化表结构
    await initializeTables();
  } catch (error) {
    console.error('数据库连接失败，使用内存存储模式:', error);
    useMemoryStore = true;
  }
}

/**
 * 初始化数据库表
 */
async function initializeTables(): Promise<void> {
  if (!pool) throw new Error('数据库连接未初始化');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_states (
      device_id VARCHAR(255) PRIMARY KEY,
      tts_used INTEGER DEFAULT 0,
      llm_used INTEGER DEFAULT 0,
      last_reset_date DATE DEFAULT CURRENT_DATE,
      api_key TEXT,
      premium_expiry TIMESTAMP,
      afdian_username VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(50) PRIMARY KEY,
      device_id VARCHAR(255) NOT NULL,
      payment_method VARCHAR(20) NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      transaction_id VARCHAR(255),
      note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TIMESTAMP,
      reviewer_note TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS health_check (
      id SERIAL PRIMARY KEY,
      check_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('数据库表初始化完成');
}

/**
 * 获取数据库连接池
 */
export function getPool(): pg.Pool {
  if (useMemoryStore || !pool) {
    throw new Error('当前使用内存存储模式或数据库未连接');
  }
  return pool;
}

/**
 * 检查是否使用内存存储
 */
export function isUsingMemoryStore(): boolean {
  return useMemoryStore;
}

// 统一导出所有函数（自动选择实现）
export const getUserState = useMemoryStore ? memoryStore.getUserState : import('./userState').then(m => m.getUserState);
export const updateUserState = useMemoryStore ? memoryStore.updateUserState : import('./userState').then(m => m.updateUserState);
export const getUserApiKey = useMemoryStore ? memoryStore.getUserApiKey : import('./userState').then(m => m.getUserApiKey);
export const setUserApiKey = useMemoryStore ? memoryStore.setUserApiKey : import('./userState').then(m => m.setUserApiKey);
export const activatePremium = useMemoryStore ? memoryStore.activatePremium : import('./userState').then(m => m.activatePremium);
export const getUserRemaining = useMemoryStore ? memoryStore.getUserRemaining : import('./userState').then(m => m.getUserRemaining);
export const isPremiumValid = useMemoryStore ? memoryStore.isPremiumValid : import('./userState').then(m => m.isPremiumValid);

export const createOrder = useMemoryStore ? memoryStore.createOrder : import('./order').then(m => m.createOrder);
export const getOrder = useMemoryStore ? memoryStore.getOrder : import('./order').then(m => m.getOrder);
export const getOrdersByDeviceId = useMemoryStore ? memoryStore.getOrdersByDeviceId : import('./order').then(m => m.getOrdersByDeviceId);
export const getPendingOrders = useMemoryStore ? memoryStore.getPendingOrders : import('./order').then(m => m.getPendingOrders);
export const getAllOrders = useMemoryStore ? memoryStore.getAllOrders : import('./order').then(m => m.getAllOrders);
export const reviewOrder = useMemoryStore ? memoryStore.reviewOrder : import('./order').then(m => m.reviewOrder);
export const getOrderStats = useMemoryStore ? memoryStore.getOrderStats : import('./order').then(m => m.getOrderStats);

// 导出内存存储函数（用于数据库不可用时）
export * from './memory';
