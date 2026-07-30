// POST /api/tasks/[id]?action=complete|skip|resume|delete|edit
const storage = require('../../lib/storage');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const id = req.query.id;
    const action = req.query.action;
    const payload = req.body || {};

    const data = await storage.readAll();
    const task = (data.tasks || []).find(t => t.id === id);
    if (!task) return res.status(404).json({ error: 'not found' });

    if (action === 'complete') {
      // 周期性任务完成：写入历史 + 推进下一周期 + 保持 pending
      task.history = task.history || [];
      task.history.push({
        period: task.currentPeriod,
        completedAt: storage.today(),
        note: payload.note || ''
      });
      task.currentPeriod = storage.advancePeriod(task);
      task.status = 'pending';
    } else if (action === 'skip') {
      task.status = 'skipped';
    } else if (action === 'resume') {
      task.status = 'pending';
    } else if (action === 'delete') {
      await storage.deleteTask(id);
      return res.status(200).json({ ok: true });
    } else if (action === 'edit') {
      ['name','category','cycleDesc','startDate','endDate','reminderRule','reminderRuleDesc','relatedParty','description','currentPeriod','status']
        .forEach(k => { if (payload[k] !== undefined) task[k] = payload[k]; });
    } else {
      return res.status(400).json({ error: 'unknown action: ' + action });
    }

    await storage.upsertTask(task);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
