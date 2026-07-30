// Cloudflare Pages Function: /api/tasks/[id] (POST 操作)
import { readAll, upsertTask, deleteTask, advancePeriod, today, jsonResponse } from '../../../lib/storage.mjs';

export async function onRequestPost(context) {
  const { env, request, params } = context;
  const id = params.id;
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  try {
    const data = await readAll(env);
    const task = (data.tasks || []).find(t => t.id === id);
    if (!task) return jsonResponse({ error: 'not found' }, 404);

    let payload = {};
    if (request.method === 'POST') {
      try { payload = await request.json(); } catch (e) {}
    }

    if (action === 'complete') {
      task.history = task.history || [];
      task.history.push({
        period: task.currentPeriod,
        completedAt: today(),
        note: payload.note || ''
      });
      task.currentPeriod = advancePeriod(task);
      task.status = 'pending';
    } else if (action === 'skip') {
      task.status = 'skipped';
    } else if (action === 'resume') {
      task.status = 'pending';
    } else if (action === 'delete') {
      await deleteTask(env, id);
      return jsonResponse({ ok: true });
    } else if (action === 'edit') {
      ['name','category','cycleDesc','startDate','endDate','reminderRule','reminderRuleDesc','relatedParty','description','currentPeriod','status']
        .forEach(k => { if (payload[k] !== undefined) task[k] = payload[k]; });
    } else {
      return jsonResponse({ error: 'unknown action: ' + action }, 400);
    }

    await upsertTask(env, task);
    return jsonResponse({ ok: true });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }});
}
