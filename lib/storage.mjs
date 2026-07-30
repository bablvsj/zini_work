// Cloudflare Pages Functions 用，ES modules
// 和 lib/storage.js 逻辑相同，但纯 ESM + 不依赖 Node fs（Pages Functions 无 fs）
import { createClient } from '@supabase/supabase-js';

let _client = null;
let _clientUrl = null;

function getClient(env) {
  const url = env && env.SUPABASE_URL;
  const key = env && env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY (config env in Cloudflare Pages Settings → Environment variables)');
  if (!_client || _clientUrl !== url) {
    _client = createClient(url, key);
    _clientUrl = url;
  }
  return _client;
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

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

export async function readAll(env) {
  const sb = getClient(env);
  const { data, error } = await sb.from('tasks').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return {
    version: '1.0',
    updatedAt: today(),
    nextScanInfo: '每天早上 9:00 自动扫描，挑出今日到期+过期未做的任务在对话里提醒',
    tasks: (data || []).map(rowToTask)
  };
}

export async function upsertTask(env, task) {
  const sb = getClient(env);
  const { error } = await sb.from('tasks').upsert(taskToRow(task), { onConflict: 'id' });
  if (error) throw error;
}

export async function deleteTask(env, id) {
  const sb = getClient(env);
  const { error } = await sb.from('tasks').delete().eq('id', id);
  if (error) throw error;
}

export function advancePeriod(task) {
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

export function computeCurrentPeriod(reminderRule) {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = d.getMonth() + 1;
  if (reminderRule && reminderRule.startsWith('quarter')) {
    return `${yyyy}-Q${Math.floor((mm - 1) / 3) + 1}`;
  }
  if (reminderRule === 'year-start') return `${yyyy}`;
  return `${yyyy}-${String(mm).padStart(2,'0')}`;
}

export function scanTasks(data) {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = d.getMonth() + 1;
  const day = d.getDate();
  const q = Math.floor((mm - 1) / 3) + 1;
  const currentMonth = `${yyyy}-${String(mm).padStart(2,'0')}`;
  const currentQuarter = `${yyyy}-Q${q}`;
  const urgent = [];

  (data.tasks || []).forEach(t => {
    if (t.status !== 'pending') return;
    let due = false, overdue = false;
    if (t.reminderRule === 'monthly-10' && day >= 10) due = true;
    if (t.reminderRule === 'monthly-15' && day >= 15) due = true;
    if (t.reminderRule === 'monthly-20' && day >= 20) due = true;
    if (t.reminderRule === 'monthly-25' && day >= 25) due = true;
    if (t.reminderRule === 'monthly-last') due = true;
    if (t.reminderRule === 'quarter-start' && [1,4,7,10].includes(mm) && day >= 1) due = true;
    if (t.reminderRule === 'quarter-end' && [3,6,9,12].includes(mm) && day >= 21) due = true;
    if (t.reminderRule && t.reminderRule.startsWith('monthly') && t.currentPeriod < currentMonth) overdue = true;
    if (t.reminderRule && t.reminderRule.startsWith('quarter') && t.currentPeriod < currentQuarter) overdue = true;
    if (due || overdue) urgent.push({ ...t, _due: due, _overdue: overdue });
  });

  return {
    date: `${yyyy}-${String(mm).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
    currentMonth, currentQuarter,
    urgent,
    total: (data.tasks || []).length,
    pending: (data.tasks || []).filter(t => t.status === 'pending').length
  };
}

export function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
