// 数据访问层
// 本地开发（无 SUPABASE_URL 环境变量）→ 读写本地 tasks.js 文件
// Vercel 生产（有 SUPABASE_URL）→ 调 Supabase REST API
// 切换对外部透明，调用方只跟 readAll/upsertTask/deleteTask 打交道

const fs = require('fs');
const path = require('path');

const USE_SUPABASE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
const TASKS_FILE = path.join(__dirname, '..', 'tasks.js');

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ============= File 模式（本地开发） =============
function readTasksFileSync() {
  try {
    const content = fs.readFileSync(TASKS_FILE, 'utf8');
    const m = content.match(/window\.TASKS\s*=\s*([\s\S]+?);\s*$/);
    if (!m) return { version: '1.0', updatedAt: today(), tasks: [] };
    return JSON.parse(m[1]);
  } catch (e) {
    return { version: '1.0', updatedAt: today(), tasks: [] };
  }
}

function writeTasksFileSync(data) {
  const content = `// 工作追踪数据文件 - 由 WorkBuddy 维护
// 本地开发模式自动生成，请勿手动编辑
window.TASKS = ${JSON.stringify(data, null, 2)};\n`;
  fs.writeFileSync(TASKS_FILE, content, 'utf8');
}

// ============= Supabase 模式（Vercel 生产） =============
let _supabaseClient;
function getSupabase() {
  if (!_supabaseClient) {
    // 懒加载，本地开发模式不需要装 @supabase/supabase-js
    const { createClient } = require('@supabase/supabase-js');
    _supabaseClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
  }
  return _supabaseClient;
}

// Supabase row → task 对象（统一字段名）
function rowToTask(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    cycle: row.cycle,
    cycleDesc: row.cycle_desc,
    startDate: row.start_date,
    endDate: row.end_date,
    reminderRule: row.reminder_rule,
    reminderRuleDesc: row.reminder_rule_desc,
    relatedParty: row.related_party,
    description: row.description,
    status: row.status,
    currentPeriod: row.current_period,
    history: row.history || [],
    createdAt: row.created_at
  };
}

// task 对象 → Supabase row（snake_case）
function taskToRow(task) {
  return {
    id: task.id,
    name: task.name,
    category: task.category,
    cycle: task.cycle,
    cycle_desc: task.cycleDesc,
    start_date: task.startDate,
    end_date: task.endDate,
    reminder_rule: task.reminderRule,
    reminder_rule_desc: task.reminderRuleDesc,
    related_party: task.relatedParty,
    description: task.description,
    status: task.status,
    current_period: task.currentPeriod,
    history: task.history || []
  };
}

async function readTasksSupabase() {
  const sb = getSupabase();
  const { data, error } = await sb.from('tasks').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return {
    version: '1.0',
    updatedAt: today(),
    nextScanInfo: '每天早上 9:00 自动扫描，挑出今日到期+过期未做的任务在对话里提醒',
    tasks: (data || []).map(rowToTask)
  };
}

async function upsertTaskSupabase(task) {
  const sb = getSupabase();
  const { error } = await sb.from('tasks').upsert(taskToRow(task), { onConflict: 'id' });
  if (error) throw error;
}

async function deleteTaskSupabase(id) {
  const sb = getSupabase();
  const { error } = await sb.from('tasks').delete().eq('id', id);
  if (error) throw error;
}

// ============= 统一接口 =============
async function readAll() {
  if (USE_SUPABASE) return await readTasksSupabase();
  return readTasksFileSync();
}

async function upsertTask(task) {
  if (USE_SUPABASE) return await upsertTaskSupabase(task);
  const data = readTasksFileSync();
  const idx = data.tasks.findIndex(t => t.id === task.id);
  if (idx === -1) data.tasks.push(task);
  else data.tasks[idx] = task;
  data.updatedAt = today();
  writeTasksFileSync(data);
}

async function deleteTask(id) {
  if (USE_SUPABASE) return await deleteTaskSupabase(id);
  const data = readTasksFileSync();
  data.tasks = data.tasks.filter(t => t.id !== id);
  data.updatedAt = today();
  writeTasksFileSync(data);
}

// 工具：算下一周期标识
function advancePeriod(task) {
  if (task.reminderRule && task.reminderRule.startsWith('monthly')) {
    const m = task.currentPeriod.match(/^(\d{4})-(\d{2})$/);
    if (m) {
      let ny = parseInt(m[1]), nm = parseInt(m[2]) + 1;
      if (nm > 12) { ny++; nm = 1; }
      return `${ny}-${String(nm).padStart(2,'0')}`;
    }
  }
  if (task.reminderRule && task.reminderRule.startsWith('quarter')) {
    const m = task.currentPeriod.match(/^(\d{4})-Q(\d)$/);
    if (m) {
      let ny = parseInt(m[1]), nq = parseInt(m[2]) + 1;
      if (nq > 4) { ny++; nq = 1; }
      return `${ny}-Q${nq}`;
    }
  }
  return task.currentPeriod;
}

function computeCurrentPeriod(reminderRule) {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = d.getMonth() + 1;
  if (reminderRule && reminderRule.startsWith('quarter')) {
    return `${yyyy}-Q${Math.floor((mm - 1) / 3) + 1}`;
  }
  if (reminderRule === 'year-start') return `${yyyy}`;
  return `${yyyy}-${String(mm).padStart(2,'0')}`;
}

module.exports = {
  USE_SUPABASE,
  today,
  readAll,
  upsertTask,
  deleteTask,
  advancePeriod,
  computeCurrentPeriod
};
