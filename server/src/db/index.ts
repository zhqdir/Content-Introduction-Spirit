import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;
let dbAvailable = false;

/**
 * 初始化数据库连接
 */
export async function initializeDatabase(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.warn('DATABASE_URL 环境变量未设置，使用内存存储模式（仅用于开发环境）');
    dbAvailable = false;
    return;
  }

  try {
    pool = new Pool({
      connectionString: databaseUrl,
    });

    // 测试连接
    await pool.query('SELECT 1');
    console.log('数据库连接成功');
    dbAvailable = true;

    // 初始化表结构
    await initializeTables();
  } catch (error) {
    console.error('数据库连接失败，使用内存存储模式:', error);
    dbAvailable = false;
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
  if (!dbAvailable || !pool) {
    throw new Error('当前使用内存存储模式或数据库未连接');
  }
  return pool;
}

/**
 * 检查数据库是否可用
 */
export function isDatabaseAvailable(): boolean {
  return dbAvailable;
}
