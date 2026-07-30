// GET /api/tasks - 返回所有任务
// POST /api/tasks - 新增任务
const storage = require('../../lib/storage');

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  // GET
  if (req.method === 'GET') {
    try {
      const data = await storage.readAll();
      return res.status(200).json(data);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // POST - 新增
  if (req.method === 'POST') {
    try {
      const payload = req.body || {};
      if (!payload.name) {
        return res.status(400).json({ error: 'name 必填' });
      }

      // 算新 ID：找现有最大数字 +1
      const data = await storage.readAll();
      const ids = (data.tasks || []).map(t => parseInt((t.id || 'T000').replace('T','')) || 0);
      const newId = 'T' + String(Math.max(0, ...ids) + 1).padStart(3, '0');

      const cycleDescMap = {
        'monthly-5':'每月 5 号','monthly-10':'每月 10 号','monthly-15':'每月 15 号','monthly-20':'每月 20 号',
        'monthly-25':'每月 25 号','monthly-last':'每月最后一天',
        'quarter-start':'每季度初','quarter-end':'每季度末',
        'year-start':'每年初','custom':'自定义'
      };

      const reminderRule = payload.reminderRule || 'monthly-10';
      const task = {
        id: newId,
        name: payload.name,
        category: payload.category || '行政',
        cycle: (reminderRule.split('-')[0]) || 'monthly',
        cycleDesc: payload.cycleDesc || cycleDescMap[reminderRule] || reminderRule,
        startDate: payload.startDate || storage.today().slice(0,7),
        endDate: payload.endDate || '',
        reminderRule,
        reminderRuleDesc: payload.reminderRuleDesc || cycleDescMap[reminderRule] || '',
        relatedParty: payload.relatedParty || '',
        description: payload.description || '',
        status: 'pending',
        currentPeriod: payload.currentPeriod || storage.computeCurrentPeriod(reminderRule),
        history: [],
        createdAt: storage.today()
      };

      await storage.upsertTask(task);
      return res.status(200).json({ ok: true, task });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
