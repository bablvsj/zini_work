// GET /api/scan - 扫描今日到期+已过期未做的任务
// 供前端「立即扫描提醒」按钮 + WorkBuddy automation 调用
const storage = require('../lib/storage');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const data = await storage.readAll();
    const result = scanTasks(data);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

function scanTasks(data) {
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

    // 今日是否到提醒日
    if (t.reminderRule === 'monthly-10' && day >= 10) due = true;
    if (t.reminderRule === 'monthly-15' && day >= 15) due = true;
    if (t.reminderRule === 'monthly-20' && day >= 20) due = true;
    if (t.reminderRule === 'monthly-25' && day >= 25) due = true;
    if (t.reminderRule === 'monthly-last') due = true;
    if (t.reminderRule === 'quarter-start' && [1,4,7,10].includes(mm) && day >= 1) due = true;
    if (t.reminderRule === 'quarter-end' && [3,6,9,12].includes(mm) && day >= 21) due = true;

    // 已过期未做
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
