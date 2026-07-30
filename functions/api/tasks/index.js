// Cloudflare Pages Function: /api/tasks (GET 全部 / POST 新增)
import { readAll, upsertTask, today, computeCurrentPeriod, jsonResponse } from '../../../lib/storage.mjs';

const cycleDescMap = {
  'monthly-5':'每月 5 号','monthly-10':'每月 10 号','monthly-15':'每月 15 号','monthly-20':'每月 20 号',
  'monthly-25':'每月 25 号','monthly-last':'每月最后一天',
  'quarter-start':'每季度初','quarter-end':'每季度末',
  'year-start':'每年初','custom':'自定义'
};

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const data = await readAll(env);
    return jsonResponse(data);
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  try {
    const payload = await request.json();
    if (!payload.name) return jsonResponse({ error: 'name 必填' }, 400);

    // 算新 ID
    const data = await readAll(env);
    const ids = (data.tasks || []).map(t => parseInt((t.id || 'T000').replace('T','')) || 0);
    const newId = 'T' + String(Math.max(0, ...ids) + 1).padStart(3, '0');

    const reminderRule = payload.reminderRule || 'monthly-10';
    const task = {
      id: newId,
      name: payload.name,
      category: payload.category || '行政',
      cycle: (reminderRule.split('-')[0]) || 'monthly',
      cycleDesc: payload.cycleDesc || cycleDescMap[reminderRule] || reminderRule,
      startDate: payload.startDate || today().slice(0,7),
      endDate: payload.endDate || '',
      reminderRule,
      reminderRuleDesc: payload.reminderRuleDesc || cycleDescMap[reminderRule] || '',
      relatedParty: payload.relatedParty || '',
      description: payload.description || '',
      status: 'pending',
      currentPeriod: payload.currentPeriod || computeCurrentPeriod(reminderRule),
      history: [],
      createdAt: today()
    };

    await upsertTask(env, task);
    return jsonResponse({ ok: true, task });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }});
}
