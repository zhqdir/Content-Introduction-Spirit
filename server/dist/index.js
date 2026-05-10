// src/index.ts
import express7 from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// src/routes/tts.ts
import express from "express";
import { TTSClient, Config, HeaderUtils } from "coze-coding-dev-sdk";

// src/middleware/usageLimit.ts
import "express";

// src/db/index.ts
import pg from "pg";
var { Pool } = pg;
var pool = null;
var dbAvailable = false;
function getPool() {
  if (!dbAvailable || !pool) {
    throw new Error("\u5F53\u524D\u4F7F\u7528\u5185\u5B58\u5B58\u50A8\u6A21\u5F0F\u6216\u6570\u636E\u5E93\u672A\u8FDE\u63A5");
  }
  return pool;
}
function isDatabaseAvailable() {
  return dbAvailable;
}

// src/db/userState.ts
var memoryUserStates = /* @__PURE__ */ new Map();
async function getUserState(deviceId) {
  if (!isDatabaseAvailable()) {
    return getUserStateFromMemory(deviceId);
  }
  const pool2 = getPool();
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const result = await pool2.query(
    "SELECT * FROM user_states WHERE device_id = $1",
    [deviceId]
  );
  if (result.rows.length === 0) {
    const insertResult = await pool2.query(
      `INSERT INTO user_states (device_id, tts_used, llm_used, last_reset_date, created_at, updated_at)
       VALUES ($1, 0, 0, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [deviceId, today]
    );
    return insertResult.rows[0];
  }
  const state = result.rows[0];
  if (state.last_reset_date !== today) {
    const updateResult = await pool2.query(
      `UPDATE user_states SET tts_used = 0, llm_used = 0, last_reset_date = $1, updated_at = CURRENT_TIMESTAMP
       WHERE device_id = $2 RETURNING *`,
      [today, deviceId]
    );
    return updateResult.rows[0];
  }
  return state;
}
async function updateUserState(deviceId, updates) {
  if (!isDatabaseAvailable()) {
    updateUserStateInMemory(deviceId, updates);
    return;
  }
  const pool2 = getPool();
  const fields = [];
  const values = [];
  let paramIndex = 1;
  if (updates.ttsUsed !== void 0) {
    fields.push(`tts_used = $${paramIndex++}`);
    values.push(updates.ttsUsed);
  }
  if (updates.llmUsed !== void 0) {
    fields.push(`llm_used = $${paramIndex++}`);
    values.push(updates.llmUsed);
  }
  if (updates.apiKey !== void 0) {
    fields.push(`api_key = $${paramIndex++}`);
    values.push(updates.apiKey);
  }
  if (updates.premiumExpiry !== void 0) {
    fields.push(`premium_expiry = $${paramIndex++}`);
    values.push(updates.premiumExpiry);
  }
  if (updates.afdianUsername !== void 0) {
    fields.push(`afdian_username = $${paramIndex++}`);
    values.push(updates.afdianUsername);
  }
  if (fields.length === 0) return;
  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(deviceId);
  await pool2.query(
    `UPDATE user_states SET ${fields.join(", ")} WHERE device_id = $${paramIndex}`,
    values
  );
}
async function setUserApiKey(deviceId, apiKey) {
  if (!isDatabaseAvailable()) {
    setUserApiKeyInMemory(deviceId, apiKey);
    return;
  }
  const pool2 = getPool();
  await pool2.query(
    `INSERT INTO user_states (device_id, api_key, created_at, updated_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (device_id) DO UPDATE SET api_key = $2, updated_at = CURRENT_TIMESTAMP`,
    [deviceId, apiKey]
  );
}
async function activatePremium(deviceId, afdianUsername, days = 30) {
  if (!isDatabaseAvailable()) {
    activatePremiumInMemory(deviceId, afdianUsername, days);
    return;
  }
  const pool2 = getPool();
  const expiry = /* @__PURE__ */ new Date();
  expiry.setDate(expiry.getDate() + days);
  await pool2.query(
    `INSERT INTO user_states (device_id, premium_expiry, afdian_username, created_at, updated_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (device_id) DO UPDATE SET premium_expiry = $2, afdian_username = $3, updated_at = CURRENT_TIMESTAMP`,
    [deviceId, expiry.toISOString(), afdianUsername]
  );
}
async function getUserRemaining(deviceId) {
  const state = await getUserState(deviceId);
  const hasApiKey = !!state.apiKey;
  if (hasApiKey) {
    return { ttsRemaining: -1, llmRemaining: -1, hasApiKey: true, isPremium: false };
  }
  const isPremium = isPremiumValid(state);
  const ttsLimit = isPremium ? 100 : 5;
  const llmLimit = isPremium ? 50 : 3;
  return {
    ttsRemaining: Math.max(0, ttsLimit - state.ttsUsed),
    llmRemaining: Math.max(0, llmLimit - state.llmUsed),
    hasApiKey,
    isPremium
  };
}
function isPremiumValid(state) {
  if (!state.premiumExpiry) return false;
  return new Date(state.premiumExpiry) > /* @__PURE__ */ new Date();
}
function getUserStateFromMemory(deviceId) {
  let state = memoryUserStates.get(deviceId);
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  if (!state) {
    state = { deviceId, ttsUsed: 0, llmUsed: 0, lastResetDate: today };
    memoryUserStates.set(deviceId, state);
  } else if (state.lastResetDate !== today) {
    state.ttsUsed = 0;
    state.llmUsed = 0;
    state.lastResetDate = today;
  }
  return state;
}
function updateUserStateInMemory(deviceId, updates) {
  const state = memoryUserStates.get(deviceId);
  if (state) {
    Object.assign(state, updates);
  }
}
function setUserApiKeyInMemory(deviceId, apiKey) {
  let state = memoryUserStates.get(deviceId);
  if (!state) {
    state = { deviceId, ttsUsed: 0, llmUsed: 0, lastResetDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0] };
  }
  state.apiKey = apiKey;
  memoryUserStates.set(deviceId, state);
}
function activatePremiumInMemory(deviceId, afdianUsername, days = 30) {
  const now = /* @__PURE__ */ new Date();
  const expiry = new Date(now.getTime() + days * 24 * 60 * 60 * 1e3);
  let state = memoryUserStates.get(deviceId);
  if (!state) {
    state = { deviceId, ttsUsed: 0, llmUsed: 0, lastResetDate: now.toISOString().split("T")[0] };
  }
  state.premiumExpiry = expiry.toISOString();
  state.afdianUsername = afdianUsername;
  memoryUserStates.set(deviceId, state);
}

// src/middleware/usageLimit.ts
var FREE_LIMITS = {
  TTS_DAILY_LIMIT: 5,
  LLM_DAILY_LIMIT: 3
};
var PREMIUM_LIMITS = {
  TTS_DAILY_LIMIT: 100,
  LLM_DAILY_LIMIT: 50
};
async function checkTtsLimit(req, res, next) {
  const deviceId = req.headers["x-device-id"];
  const apiKey = req.headers["x-api-key"];
  if (apiKey) {
    next();
    return;
  }
  if (!deviceId) {
    res.status(400).json({ error: "\u7F3A\u5C11\u8BBE\u5907ID" });
    return;
  }
  const state = await getUserState(deviceId);
  if (state.apiKey) {
    next();
    return;
  }
  const isPremium = isPremiumValid(state);
  const dailyLimit = isPremium ? PREMIUM_LIMITS.TTS_DAILY_LIMIT : FREE_LIMITS.TTS_DAILY_LIMIT;
  const remaining = dailyLimit - state.ttsUsed;
  if (remaining <= 0) {
    if (isPremium) {
      res.status(500).json({ error: "\u8BBF\u95EE\u7F51\u7EDC\u670D\u52A1\u5668\u5F02\u5E38" });
    } else {
      res.status(403).json({
        error: `\u514D\u8D39\u7528\u6237\u4ECA\u65E5TTS\u6B21\u6570\u5DF2\u7528\u5B8C\uFF08${dailyLimit}\u6B21/\u5929\uFF09\u3002\u8BF7\u5347\u7EA7\u4F1A\u5458\u6216\u914D\u7F6E\u81EA\u5DF1\u7684API Key\u83B7\u53D6\u66F4\u591A\u4F7F\u7528\u6B21\u6570\u3002`,
        code: "TTS_LIMIT_EXCEEDED",
        remaining: 0,
        dailyLimit
      });
    }
    return;
  }
  await updateUserState(deviceId, { ttsUsed: state.ttsUsed + 1 });
  next();
}
async function checkLlmLimit(req, res, next) {
  const deviceId = req.headers["x-device-id"];
  const apiKey = req.headers["x-api-key"];
  if (apiKey) {
    next();
    return;
  }
  if (!deviceId) {
    res.status(400).json({ error: "\u7F3A\u5C11\u8BBE\u5907ID" });
    return;
  }
  const state = await getUserState(deviceId);
  if (state.apiKey) {
    next();
    return;
  }
  const isPremium = isPremiumValid(state);
  const dailyLimit = isPremium ? PREMIUM_LIMITS.LLM_DAILY_LIMIT : FREE_LIMITS.LLM_DAILY_LIMIT;
  const remaining = dailyLimit - state.llmUsed;
  if (remaining <= 0) {
    if (isPremium) {
      res.status(500).json({ error: "\u8BBF\u95EE\u7F51\u7EDC\u670D\u52A1\u5668\u5F02\u5E38" });
    } else {
      res.status(403).json({
        error: `\u514D\u8D39\u7528\u6237\u4ECA\u65E5\u5F52\u7EB3\u6B21\u6570\u5DF2\u7528\u5B8C\uFF08${dailyLimit}\u6B21/\u5929\uFF09\u3002\u8BF7\u5347\u7EA7\u4F1A\u5458\u6216\u914D\u7F6E\u81EA\u5DF1\u7684API Key\u83B7\u53D6\u66F4\u591A\u4F7F\u7528\u6B21\u6570\u3002`,
        code: "LLM_LIMIT_EXCEEDED",
        remaining: 0,
        dailyLimit
      });
    }
    return;
  }
  await updateUserState(deviceId, { llmUsed: state.llmUsed + 1 });
  next();
}
async function getUserStatus(deviceId) {
  const state = await getUserState(deviceId);
  const { ttsRemaining, llmRemaining, hasApiKey } = await getUserRemaining(deviceId);
  const premiumValid = isPremiumValid(state);
  return {
    deviceId,
    isPremium: premiumValid,
    premiumExpiry: state.premiumExpiry,
    afdianUsername: state.afdianUsername,
    hasApiKey,
    ttsRemaining,
    llmRemaining,
    ttsUsed: state.ttsUsed,
    llmUsed: state.llmUsed,
    ttsDailyLimit: hasApiKey ? -1 : premiumValid ? PREMIUM_LIMITS.TTS_DAILY_LIMIT : FREE_LIMITS.TTS_DAILY_LIMIT,
    llmDailyLimit: hasApiKey ? -1 : premiumValid ? PREMIUM_LIMITS.LLM_DAILY_LIMIT : FREE_LIMITS.LLM_DAILY_LIMIT
  };
}

// src/routes/tts.ts
var router = express.Router();
var DEFAULT_SPEAKER = "zh_female_xiaohe_uranus_bigtts";
router.post("/synthesize", checkTtsLimit, async (req, res) => {
  try {
    const { text, speaker, speechRate } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "\u8BF7\u63D0\u4F9B\u8981\u5408\u6210\u7684\u6587\u672C" });
    }
    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers);
    const apiKey = req.headers["x-api-key"];
    if (apiKey) {
      customHeaders["Authorization"] = `Bearer ${apiKey}`;
    }
    const config = new Config();
    const ttsClient = new TTSClient(config, customHeaders);
    const response = await ttsClient.synthesize({
      uid: "voice-butler-user",
      text: text.trim(),
      speaker: speaker || DEFAULT_SPEAKER,
      audioFormat: "mp3",
      sampleRate: 24e3,
      speechRate: speechRate ? Math.round((speechRate - 1) * 100) : 0
      // 转换为-50到100的范围
    });
    res.json({
      success: true,
      audioUri: response.audioUri,
      audioSize: response.audioSize
    });
  } catch (error) {
    console.error("TTS synthesis error:", error);
    res.status(500).json({
      error: "\u8BED\u97F3\u5408\u6210\u5931\u8D25",
      message: error.message || "Unknown error"
    });
  }
});
router.get("/voices", (_req, res) => {
  const voices = [
    { id: "zh_female_xiaohe_uranus_bigtts", name: "\u6E29\u67D4\u5973\u58F0", gender: "female", style: "gentle" },
    { id: "zh_female_vv_uranus_bigtts", name: "\u6D3B\u529B\u5973\u58F0", gender: "female", style: "energetic" },
    { id: "zh_male_m191_uranus_bigtts", name: "\u9633\u5149\u7537\u58F0", gender: "male", style: "sunny" },
    { id: "zh_male_taocheng_uranus_bigtts", name: "\u78C1\u6027\u7537\u58F0", gender: "male", style: "magnetic" },
    { id: "zh_female_xueayi_saturn_bigtts", name: "\u513F\u7AE5\u6545\u4E8B", gender: "female", style: "storytelling" },
    { id: "zh_male_dayi_saturn_bigtts", name: "\u5927\u6C14\u7537\u58F0", gender: "male", style: "dignified" },
    { id: "zh_female_mizai_saturn_bigtts", name: "\u751C\u7F8E\u5973\u58F0", gender: "female", style: "sweet" },
    { id: "zh_female_jitangnv_saturn_bigtts", name: "\u5143\u6C14\u5973\u58F0", gender: "female", style: "motivational" },
    { id: "zh_female_meilinvyou_saturn_bigtts", name: "\u90BB\u5BB6\u5973\u53CB", gender: "female", style: "friendly" },
    { id: "saturn_zh_female_tiaopigongzhu_tob", name: "\u4FCF\u76AE\u516C\u4E3B", gender: "female", style: "playful" },
    { id: "saturn_zh_male_shuanglangshaonian_tob", name: "\u723D\u6717\u5C11\u5E74", gender: "male", style: "cheerful" }
  ];
  res.json({ voices });
});
var tts_default = router;

// src/routes/llm.ts
import express2 from "express";
import { LLMClient, Config as Config2, HeaderUtils as HeaderUtils2 } from "coze-coding-dev-sdk";
var router2 = express2.Router();
function generatePersonalizedReport(summary, title) {
  const greetings = [
    `${title}\uFF0C\u4E3A\u60A8\u603B\u7ED3\u5982\u4E0B\uFF1A`,
    `${title}\uFF0C\u4EE5\u4E0B\u662F\u672C\u6B21\u5185\u5BB9\u8981\u70B9\uFF1A`,
    `${title}\uFF0C\u6211\u6765\u4E3A\u60A8\u6C47\u62A5\uFF1A`
  ];
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];
  return `${greeting}

${summary}`;
}
router2.post("/summarize", checkLlmLimit, async (req, res) => {
  try {
    const { text, title = "\u8001\u677F" } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "\u8BF7\u63D0\u4F9B\u8981\u603B\u7ED3\u7684\u6587\u672C" });
    }
    const maxLength = 8e3;
    const truncatedText = text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
    const customHeaders = HeaderUtils2.extractForwardHeaders(req.headers);
    const apiKey = req.headers["x-api-key"];
    if (apiKey) {
      customHeaders["Authorization"] = `Bearer ${apiKey}`;
    }
    const config = new Config2();
    const llmClient = new LLMClient(config, customHeaders);
    const systemPrompt = `\u4F60\u662F\u4E00\u4F4D\u4E13\u4E1A\u7684\u8BED\u97F3\u7BA1\u5BB6\u52A9\u624B\uFF0C\u64C5\u957F\u4E3A\u7528\u6237\u603B\u7ED3\u548C\u6C47\u62A5\u5185\u5BB9\u3002

\u4F60\u7684\u4EFB\u52A1\u662F\u5C06\u7528\u6237\u63D0\u4F9B\u7684\u6587\u672C\u5185\u5BB9\u8FDB\u884C\u7B80\u6D01\u3001\u6E05\u6670\u7684\u5F52\u7EB3\u603B\u7ED3\uFF0C\u4FBF\u4E8E\u8BED\u97F3\u6717\u8BFB\u3002

\u603B\u7ED3\u8981\u6C42\uFF1A
1. \u63D0\u53D6\u6838\u5FC3\u8981\u70B9\uFF0C\u53BB\u9664\u5197\u4F59\u4FE1\u606F
2. \u4FDD\u6301\u8BED\u8A00\u7B80\u6D01\u6D41\u7545\uFF0C\u9002\u5408\u8BED\u97F3\u6717\u8BFB
3. \u63A7\u5236\u57283-5\u4E2A\u8981\u70B9\uFF0C\u6BCF\u4E2A\u8981\u70B9\u4E0D\u8D85\u8FC750\u5B57
4. \u4F7F\u7528\u6E05\u6670\u7684\u7ED3\u6784\uFF0C\u5982"\u7B2C\u4E00..."\u3001"\u7B2C\u4E8C..."\u7B49
5. \u8BED\u6C14\u6E29\u548C\u4EB2\u5207\uFF0C\u50CF\u7BA1\u5BB6\u5411\u4E3B\u4EBA\u6C47\u62A5\u5DE5\u4F5C\u4E00\u6837

\u8BF7\u76F4\u63A5\u8F93\u51FA\u603B\u7ED3\u5185\u5BB9\uFF0C\u4E0D\u8981\u6709\u4EFB\u4F55\u524D\u7F00\u6216\u89E3\u91CA\u3002`;
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `\u8BF7\u603B\u7ED3\u4EE5\u4E0B\u5185\u5BB9\uFF1A

${truncatedText}` }
    ];
    const response = await llmClient.invoke(messages, {
      model: "doubao-seed-1-6-lite-251015",
      temperature: 0.7
    });
    const personalizedReport = generatePersonalizedReport(response.content, title);
    res.json({
      success: true,
      summary: personalizedReport,
      originalLength: text.length,
      summaryLength: personalizedReport.length
    });
  } catch (error) {
    console.error("LLM summarization error:", error);
    res.status(500).json({
      error: "\u6587\u672C\u603B\u7ED3\u5931\u8D25",
      message: error.message || "Unknown error"
    });
  }
});
router2.post("/stream-summarize", checkLlmLimit, async (req, res) => {
  try {
    const { text, title = "\u8001\u677F" } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "\u8BF7\u63D0\u4F9B\u8981\u603B\u7ED3\u7684\u6587\u672C" });
    }
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, no-transform, must-revalidate");
    res.setHeader("Connection", "keep-alive");
    const maxLength = 8e3;
    const truncatedText = text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
    const customHeaders = HeaderUtils2.extractForwardHeaders(req.headers);
    const apiKey = req.headers["x-api-key"];
    if (apiKey) {
      customHeaders["Authorization"] = `Bearer ${apiKey}`;
    }
    const config = new Config2();
    const llmClient = new LLMClient(config, customHeaders);
    const systemPrompt = `\u4F60\u662F\u4E00\u4F4D\u4E13\u4E1A\u7684\u8BED\u97F3\u7BA1\u5BB6\u52A9\u624B\uFF0C\u64C5\u957F\u4E3A\u7528\u6237\u603B\u7ED3\u548C\u6C47\u62A5\u5185\u5BB9\u3002

\u4F60\u7684\u4EFB\u52A1\u662F\u5C06\u7528\u6237\u63D0\u4F9B\u7684\u6587\u672C\u5185\u5BB9\u8FDB\u884C\u7B80\u6D01\u3001\u6E05\u6670\u7684\u5F52\u7EB3\u603B\u7ED3\uFF0C\u4FBF\u4E8E\u8BED\u97F3\u6717\u8BFB\u3002

\u603B\u7ED3\u8981\u6C42\uFF1A
1. \u63D0\u53D6\u6838\u5FC3\u8981\u70B9\uFF0C\u53BB\u9664\u5197\u4F59\u4FE1\u606F
2. \u4FDD\u6301\u8BED\u8A00\u7B80\u6D01\u6D41\u7545\uFF0C\u9002\u5408\u8BED\u97F3\u6717\u8BFB
3. \u63A7\u5236\u57283-5\u4E2A\u8981\u70B9\uFF0C\u6BCF\u4E2A\u8981\u70B9\u4E0D\u8D85\u8FC750\u5B57
4. \u4F7F\u7528\u6E05\u6670\u7684\u7ED3\u6784\uFF0C\u5982"\u7B2C\u4E00..."\u3001"\u7B2C\u4E8C..."\u7B49
5. \u8BED\u6C14\u6E29\u548C\u4EB2\u5207\uFF0C\u50CF\u7BA1\u5BB6\u5411\u4E3B\u4EBA\u6C47\u62A5\u5DE5\u4F5C\u4E00\u6837

\u8BF7\u76F4\u63A5\u8F93\u51FA\u603B\u7ED3\u5185\u5BB9\uFF0C\u4E0D\u8981\u6709\u4EFB\u4F55\u524D\u7F00\u6216\u89E3\u91CA\u3002`;
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `\u8BF7\u603B\u7ED3\u4EE5\u4E0B\u5185\u5BB9\uFF1A

${truncatedText}` }
    ];
    const greeting = `${title}\uFF0C\u4E3A\u60A8\u603B\u7ED3\u5982\u4E0B\uFF1A

`;
    res.write(`data: ${JSON.stringify({ content: greeting })}

`);
    const stream = llmClient.stream(messages, {
      model: "doubao-seed-1-6-lite-251015",
      temperature: 0.7
    });
    for await (const chunk of stream) {
      if (chunk.content) {
        res.write(`data: ${JSON.stringify({ content: chunk.content.toString() })}

`);
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("LLM stream summarization error:", error);
    res.write(`data: ${JSON.stringify({ error: "\u6587\u672C\u603B\u7ED3\u5931\u8D25" })}

`);
    res.end();
  }
});
var llm_default = router2;

// src/routes/fetch.ts
import express3 from "express";
import { FetchClient, Config as Config3, HeaderUtils as HeaderUtils3 } from "coze-coding-dev-sdk";
var router3 = express3.Router();
router3.post("/url", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "\u8BF7\u63D0\u4F9B\u6709\u6548\u7684\u7F51\u5740\u94FE\u63A5" });
    }
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: "\u8BF7\u63D0\u4F9B\u6709\u6548\u7684\u7F51\u5740\u94FE\u63A5" });
    }
    const customHeaders = HeaderUtils3.extractForwardHeaders(req.headers);
    const config = new Config3();
    const fetchClient = new FetchClient(config, customHeaders);
    const response = await fetchClient.fetch(url);
    if (response.status_code !== 0) {
      return res.status(400).json({
        error: "\u65E0\u6CD5\u83B7\u53D6\u7F51\u9875\u5185\u5BB9",
        message: response.status_message || "Unknown error"
      });
    }
    const textContent = response.content.filter((item) => item.type === "text" && item.text).map((item) => item.text).join("\n\n");
    if (!textContent.trim()) {
      return res.status(400).json({ error: "\u8BE5\u7F51\u9875\u672A\u627E\u5230\u53EF\u6717\u8BFB\u7684\u6587\u672C\u5185\u5BB9" });
    }
    res.json({
      success: true,
      title: response.title || "\u672A\u77E5\u6807\u9898",
      url: response.url || url,
      text: textContent,
      textLength: textContent.length
    });
  } catch (error) {
    console.error("Fetch URL error:", error);
    res.status(500).json({
      error: "\u83B7\u53D6\u7F51\u9875\u5185\u5BB9\u5931\u8D25",
      message: error.message || "Unknown error"
    });
  }
});
var fetch_default = router3;

// src/routes/user.ts
import express4 from "express";
var router4 = express4.Router();
router4.get("/status", async (req, res) => {
  const deviceId = req.headers["x-device-id"];
  if (!deviceId) {
    return res.status(400).json({ error: "\u7F3A\u5C11\u8BBE\u5907ID" });
  }
  const status = await getUserStatus(deviceId);
  res.json(status);
});
router4.post("/api-key", (req, res) => {
  const deviceId = req.headers["x-device-id"];
  const { apiKey } = req.body;
  if (!deviceId) {
    return res.status(400).json({ error: "\u7F3A\u5C11\u8BBE\u5907ID" });
  }
  if (!apiKey || typeof apiKey !== "string") {
    return res.status(400).json({ error: "\u8BF7\u63D0\u4F9B\u6709\u6548\u7684API Key" });
  }
  if (apiKey.length < 10) {
    return res.status(400).json({ error: "API Key\u683C\u5F0F\u4E0D\u6B63\u786E" });
  }
  setUserApiKey(deviceId, apiKey);
  res.json({
    success: true,
    message: "API Key\u8BBE\u7F6E\u6210\u529F",
    hasApiKey: true
  });
});
router4.delete("/api-key", (req, res) => {
  const deviceId = req.headers["x-device-id"];
  if (!deviceId) {
    return res.status(400).json({ error: "\u7F3A\u5C11\u8BBE\u5907ID" });
  }
  setUserApiKey(deviceId, "");
  res.json({
    success: true,
    message: "API Key\u5DF2\u5220\u9664",
    hasApiKey: false
  });
});
router4.get("/remaining", async (req, res) => {
  const deviceId = req.headers["x-device-id"];
  if (!deviceId) {
    return res.status(400).json({ error: "\u7F3A\u5C11\u8BBE\u5907ID" });
  }
  const remaining = await getUserRemaining(deviceId);
  res.json(remaining);
});
var user_default = router4;

// src/routes/payment.ts
import express5 from "express";

// src/db/order.ts
var memoryOrders = /* @__PURE__ */ new Map();
function generateOrderId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `VB${timestamp}${random}`;
}
async function createOrder(data) {
  if (!isDatabaseAvailable()) {
    return createOrderInMemory(data);
  }
  const pool2 = getPool();
  const id = generateOrderId();
  const now = /* @__PURE__ */ new Date();
  const result = await pool2.query(
    `INSERT INTO orders (id, device_id, payment_method, amount, status, transaction_id, note, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8) RETURNING *`,
    [id, data.deviceId, data.paymentMethod, data.amount, data.transactionId.trim(), data.note?.trim(), now, now]
  );
  return result.rows[0];
}
async function getOrder(id) {
  if (!isDatabaseAvailable()) {
    return memoryOrders.get(id);
  }
  const pool2 = getPool();
  const result = await pool2.query("SELECT * FROM orders WHERE id = $1", [id]);
  return result.rows[0];
}
async function getOrdersByDeviceId(deviceId) {
  if (!isDatabaseAvailable()) {
    return Array.from(memoryOrders.values()).filter((order) => order.deviceId === deviceId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  const pool2 = getPool();
  const result = await pool2.query(
    "SELECT * FROM orders WHERE device_id = $1 ORDER BY created_at DESC",
    [deviceId]
  );
  return result.rows;
}
function createOrderInMemory(data) {
  const id = generateOrderId();
  const now = /* @__PURE__ */ new Date();
  const order = {
    id,
    deviceId: data.deviceId,
    paymentMethod: data.paymentMethod,
    amount: data.amount,
    status: "pending",
    transactionId: data.transactionId.trim(),
    note: data.note?.trim(),
    createdAt: now,
    updatedAt: now
  };
  memoryOrders.set(id, order);
  return order;
}

// src/routes/payment.ts
var router5 = express5.Router();
var MEMBERSHIP_PRICES = {
  monthly: 30,
  quarterly: 80,
  yearly: 300
};
router5.get("/prices", (_req, res) => {
  res.json({
    prices: MEMBERSHIP_PRICES,
    plans: [
      { id: "monthly", name: "\u6708\u5EA6\u4F1A\u5458", price: MEMBERSHIP_PRICES.monthly, days: 30 },
      { id: "quarterly", name: "\u5B63\u5EA6\u4F1A\u5458", price: MEMBERSHIP_PRICES.quarterly, days: 90 },
      { id: "yearly", name: "\u5E74\u5EA6\u4F1A\u5458", price: MEMBERSHIP_PRICES.yearly, days: 365 }
    ]
  });
});
router5.post("/order", async (req, res) => {
  const deviceId = req.headers["x-device-id"];
  const { paymentMethod, amount, transactionId, note } = req.body;
  if (!deviceId) {
    return res.status(400).json({ error: "\u7F3A\u5C11\u8BBE\u5907ID" });
  }
  if (!paymentMethod || !["wechat", "alipay"].includes(paymentMethod)) {
    return res.status(400).json({ error: "\u8BF7\u9009\u62E9\u652F\u4ED8\u65B9\u5F0F\uFF08\u5FAE\u4FE1\u6216\u652F\u4ED8\u5B9D\uFF09" });
  }
  if (!amount || amount < MEMBERSHIP_PRICES.monthly) {
    return res.status(400).json({ error: `\u91D1\u989D\u4E0D\u80FD\u4F4E\u4E8E${MEMBERSHIP_PRICES.monthly}\u5143` });
  }
  if (!transactionId || typeof transactionId !== "string") {
    return res.status(400).json({ error: "\u8BF7\u63D0\u4F9B\u4EA4\u6613\u5355\u53F7" });
  }
  try {
    const order = await createOrder({
      deviceId,
      paymentMethod,
      amount,
      transactionId: transactionId.trim(),
      note: note?.trim()
    });
    res.json({
      success: true,
      message: "\u8BA2\u5355\u63D0\u4EA4\u6210\u529F\uFF0C\u8BF7\u7B49\u5F85\u5BA1\u6838",
      order: {
        id: order.id,
        amount: order.amount,
        status: order.status,
        createdAt: order.createdAt
      }
    });
  } catch (error) {
    console.error("\u521B\u5EFA\u8BA2\u5355\u5931\u8D25:", error);
    res.status(500).json({ error: "\u521B\u5EFA\u8BA2\u5355\u5931\u8D25" });
  }
});
router5.get("/orders", async (req, res) => {
  const deviceId = req.headers["x-device-id"];
  if (!deviceId) {
    return res.status(400).json({ error: "\u7F3A\u5C11\u8BBE\u5907ID" });
  }
  try {
    const orders = await getOrdersByDeviceId(deviceId);
    res.json({ orders });
  } catch (error) {
    res.status(500).json({ error: "\u83B7\u53D6\u8BA2\u5355\u5931\u8D25" });
  }
});
router5.get("/order/:id", async (req, res) => {
  const { id } = req.params;
  const orderId = Array.isArray(id) ? id[0] : id;
  const deviceId = req.headers["x-device-id"];
  try {
    const order = await getOrder(orderId);
    if (!order) {
      return res.status(404).json({ error: "\u8BA2\u5355\u4E0D\u5B58\u5728" });
    }
    if (order.deviceId !== deviceId) {
      return res.status(403).json({ error: "\u65E0\u6743\u67E5\u770B\u6B64\u8BA2\u5355" });
    }
    res.json({ order });
  } catch (error) {
    res.status(500).json({ error: "\u83B7\u53D6\u8BA2\u5355\u8BE6\u60C5\u5931\u8D25" });
  }
});
router5.post("/afdian", async (req, res) => {
  const deviceId = req.headers["x-device-id"];
  const { username } = req.body;
  if (!deviceId) {
    return res.status(400).json({ error: "\u7F3A\u5C11\u8BBE\u5907ID" });
  }
  if (!username || typeof username !== "string") {
    return res.status(400).json({ error: "\u8BF7\u63D0\u4F9B\u7231\u53D1\u7535\u7528\u6237\u540D" });
  }
  try {
    await activatePremium(deviceId, username);
    res.json({
      success: true,
      message: "\u7231\u53D1\u7535\u4F1A\u5458\u6FC0\u6D3B\u6210\u529F",
      afdianUsername: username
    });
  } catch (error) {
    console.error("\u7231\u53D1\u7535\u6FC0\u6D3B\u5931\u8D25:", error);
    res.status(500).json({ error: "\u7231\u53D1\u7535\u6FC0\u6D3B\u5931\u8D25" });
  }
});
var payment_default = router5;

// src/routes/admin.ts
import express6 from "express";

// src/services/order.ts
var orderStore = /* @__PURE__ */ new Map();
function getOrder2(id) {
  return orderStore.get(id);
}
function getPendingOrders() {
  return Array.from(orderStore.values()).filter((order) => order.status === "pending").sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
function getAllOrders() {
  return Array.from(orderStore.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
function reviewOrder(id, approved, reviewerNote) {
  const order = orderStore.get(id);
  if (!order) return void 0;
  order.status = approved ? "approved" : "rejected";
  order.updatedAt = /* @__PURE__ */ new Date();
  order.reviewedAt = /* @__PURE__ */ new Date();
  order.reviewerNote = reviewerNote;
  orderStore.set(id, order);
  return order;
}
function getOrderStats() {
  const orders = Array.from(orderStore.values());
  return {
    total: orders.length,
    pending: orders.filter((o) => o.status === "pending").length,
    approved: orders.filter((o) => o.status === "approved").length,
    rejected: orders.filter((o) => o.status === "rejected").length,
    totalAmount: orders.filter((o) => o.status === "approved").reduce((sum, o) => sum + o.amount, 0)
  };
}
var MEMBERSHIP_PRICES2 = {
  monthly: 9.9,
  // 月度会员
  quarterly: 24.9,
  // 季度会员
  yearly: 89.9
  // 年度会员
};
function getMembershipDays(amount) {
  if (amount >= MEMBERSHIP_PRICES2.yearly) return 365;
  if (amount >= MEMBERSHIP_PRICES2.quarterly) return 90;
  if (amount >= MEMBERSHIP_PRICES2.monthly) return 30;
  return 0;
}

// src/routes/admin.ts
var router6 = express6.Router();
var ADMIN_PASSWORD = "voicebutler2024";
function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${ADMIN_PASSWORD}`) {
    res.status(401).json({ error: "\u672A\u6388\u6743\u8BBF\u95EE" });
    return;
  }
  next();
}
router6.post("/login", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({
      success: true,
      token: ADMIN_PASSWORD,
      message: "\u767B\u5F55\u6210\u529F"
    });
  } else {
    res.status(401).json({ error: "\u5BC6\u7801\u9519\u8BEF" });
  }
});
router6.get("/orders", adminAuth, (req, res) => {
  const status = req.query.status;
  let orders;
  if (status === "pending") {
    orders = getPendingOrders();
  } else {
    orders = getAllOrders();
  }
  res.json({ orders });
});
router6.get("/stats", adminAuth, (_req, res) => {
  const stats = getOrderStats();
  res.json(stats);
});
router6.post("/review/:id", adminAuth, (req, res) => {
  const { id } = req.params;
  const orderId = Array.isArray(id) ? id[0] : id;
  const { approved, note } = req.body;
  if (typeof approved !== "boolean") {
    return res.status(400).json({ error: "\u8BF7\u6307\u5B9A\u5BA1\u6838\u7ED3\u679C" });
  }
  const order = getOrder2(orderId);
  if (!order) {
    return res.status(404).json({ error: "\u8BA2\u5355\u4E0D\u5B58\u5728" });
  }
  if (order.status !== "pending") {
    return res.status(400).json({ error: "\u8BE5\u8BA2\u5355\u5DF2\u88AB\u5BA1\u6838" });
  }
  const updatedOrder = reviewOrder(orderId, approved, note);
  if (approved && updatedOrder) {
    const days = getMembershipDays(order.amount);
    if (days > 0) {
      activatePremium(order.deviceId, void 0, days);
    }
  }
  res.json({
    success: true,
    message: approved ? "\u8BA2\u5355\u5DF2\u901A\u8FC7\uFF0C\u4F1A\u5458\u5DF2\u6FC0\u6D3B" : "\u8BA2\u5355\u5DF2\u62D2\u7EDD",
    order: updatedOrder
  });
});
router6.post("/activate", adminAuth, (req, res) => {
  const { deviceId, days } = req.body;
  if (!deviceId) {
    return res.status(400).json({ error: "\u8BF7\u63D0\u4F9B\u8BBE\u5907ID" });
  }
  if (!days || days < 1) {
    return res.status(400).json({ error: "\u8BF7\u63D0\u4F9B\u6709\u6548\u7684\u5929\u6570" });
  }
  activatePremium(deviceId, void 0, days);
  res.json({
    success: true,
    message: `\u5DF2\u4E3A\u8BBE\u5907 ${deviceId} \u6FC0\u6D3B ${days} \u5929\u4F1A\u5458`
  });
});
router6.get("/dashboard", (_req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>\u8BED\u97F3\u7BA1\u5BB6 - \u7BA1\u7406\u540E\u53F0</title>
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
      <h2>\u{1F510} \u7BA1\u7406\u5458\u767B\u5F55</h2>
      <div class="form-group">
        <label>\u7BA1\u7406\u5458\u5BC6\u7801</label>
        <input type="password" id="password" placeholder="\u8BF7\u8F93\u5165\u7BA1\u7406\u5458\u5BC6\u7801" onkeypress="if(event.key==='Enter')login()">
      </div>
      <button class="btn" onclick="login()">\u767B\u5F55</button>
      <p id="loginError" style="color: red; margin-top: 12px; text-align: center;"></p>
    </div>
  </div>

  <div id="dashboardScreen" class="container hidden">
    <div class="header">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1>\u{1F3AF} \u8BED\u97F3\u7BA1\u5BB6\u7BA1\u7406\u540E\u53F0</h1>
          <p>\u8BA2\u5355\u7BA1\u7406\u4E0E\u4F1A\u5458\u6FC0\u6D3B</p>
        </div>
        <button class="logout-btn" onclick="logout()">\u9000\u51FA\u767B\u5F55</button>
      </div>
    </div>
    
    <div class="stats" id="statsContainer"></div>
    
    <div class="orders-table">
      <table>
        <thead>
          <tr>
            <th>\u8BA2\u5355ID</th>
            <th>\u8BBE\u5907ID</th>
            <th>\u652F\u4ED8\u65B9\u5F0F</th>
            <th>\u91D1\u989D</th>
            <th>\u4EA4\u6613\u5355\u53F7</th>
            <th>\u5907\u6CE8</th>
            <th>\u72B6\u6001</th>
            <th>\u63D0\u4EA4\u65F6\u95F4</th>
            <th>\u64CD\u4F5C</th>
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
          errorEl.textContent = data.error || '\u767B\u5F55\u5931\u8D25';
        }
      } catch (e) {
        errorEl.textContent = '\u7F51\u7EDC\u9519\u8BEF\uFF0C\u8BF7\u91CD\u8BD5';
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
          <h3>\u603B\u8BA2\u5355\u6570</h3>
          <div class="value">\${data.total}</div>
        </div>
        <div class="stat-card">
          <h3>\u5F85\u5BA1\u6838</h3>
          <div class="value" style="color: #FF9800;">\${data.pending}</div>
        </div>
        <div class="stat-card">
          <h3>\u5DF2\u901A\u8FC7</h3>
          <div class="value" style="color: #4CAF50;">\${data.approved}</div>
        </div>
        <div class="stat-card">
          <h3>\u603B\u6536\u5165</h3>
          <div class="value" style="color: #6C63FF;">\xA5\${data.totalAmount.toFixed(2)}</div>
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
          <td>\${order.paymentMethod === 'wechat' ? '\u5FAE\u4FE1' : '\u652F\u4ED8\u5B9D'}</td>
          <td>\xA5\${order.amount}</td>
          <td><code>\${order.transactionId}</code></td>
          <td>\${order.note || '-'}</td>
          <td>
            <span class="status-badge status-\${order.status}">
              \${order.status === 'pending' ? '\u5F85\u5BA1\u6838' : order.status === 'approved' ? '\u5DF2\u901A\u8FC7' : '\u5DF2\u62D2\u7EDD'}
            </span>
          </td>
          <td>\${new Date(order.createdAt).toLocaleString()}</td>
          <td>
            \${order.status === 'pending' ? \`
              <div class="actions">
                <button class="btn-success" onclick="review('\${order.id}', true)">\u901A\u8FC7</button>
                <button class="btn-danger" onclick="review('\${order.id}', false)">\u62D2\u7EDD</button>
              </div>
            \` : order.reviewedAt ? \`\u5BA1\u6838\u4E8E \${new Date(order.reviewedAt).toLocaleString()}\` : '-'}
          </td>
        </tr>
      \`).join('');
    }
    
    async function review(orderId, approved) {
      if (!confirm(approved ? '\u786E\u8BA4\u901A\u8FC7\u8BE5\u8BA2\u5355\uFF1F' : '\u786E\u8BA4\u62D2\u7EDD\u8BE5\u8BA2\u5355\uFF1F')) return;
      
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
        alert(data.error || '\u64CD\u4F5C\u5931\u8D25');
      }
    }
  </script>
</body>
</html>
  `;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});
var admin_default = router6;

// src/index.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express7();
var port = process.env.PORT || 8080;
app.use(cors());
app.use(express7.json({ limit: "50mb" }));
app.use(express7.urlencoded({ limit: "50mb", extended: true }));
var clientBuildPath = path.join(__dirname, "../../client/dist");
app.use(express7.static(clientBuildPath));
app.get("/api/v1/health", (req, res) => {
  console.log("Health check success");
  res.status(200).json({ status: "ok" });
});
app.use("/api/v1/tts", tts_default);
app.use("/api/v1/llm", llm_default);
app.use("/api/v1/fetch", fetch_default);
app.use("/api/v1/user", user_default);
app.use("/api/v1/payment", payment_default);
app.use("/api/v1/admin", admin_default);
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(clientBuildPath, "index.html"));
  }
});
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}/`);
});
