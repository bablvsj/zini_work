-- WorkTracker Supabase 建表脚本
-- 在 Supabase Dashboard → SQL Editor → New Query 里粘贴执行

-- 任务表
create table if not exists tasks (
  id text primary key,                              -- 任务 ID（如 T001）
  name text not null,                                -- 任务名称
  category text default '行政',                     -- 类型：行政 / 财务
  cycle text,                                        -- 周期类型（monthly/quarterly/yearly）
  cycle_desc text,                                  -- 周期描述（如 每月 10 号）
  start_date text,                                   -- 起始月/季度（如 2026-01 或 2026-Q3）
  end_date text,                                     -- 结束月/季度（空=长期）
  reminder_rule text,                               -- 提醒规则代码（如 monthly-10）
  reminder_rule_desc text,                           -- 提醒规则描述
  related_party text,                                -- 相关方（如 主任 / 租赁公司）
  description text,                                  -- 任务描述
  status text default 'pending',                     -- 状态：pending / done / skipped
  current_period text,                               -- 当前应做周期（如 2026-08 或 2026-Q3）
  history jsonb default '[]'::jsonb,                -- 完成历史 [{period, completedAt, note}]
  created_at timestamptz default now(),              -- 创建时间
  updated_at timestamptz default now()               -- 更新时间（自动维护触发器）
);

-- 更新时间触发器
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tasks_updated_at on tasks;
create trigger tasks_updated_at
  before update on tasks
  for each row execute function update_updated_at();

-- 启用 Row Level Security，并允许匿名访问（个人项目可简化，正式部署建议加用户认证）
alter table tasks enable row level security;
drop policy if exists "Allow all access" on tasks;
create policy "Allow all access" on tasks
  for all using (true) with check (true);

-- 索引：按状态和当前周期查询（automation 扫描用）
create index if not exists idx_tasks_status on tasks(status);
create index if not exists idx_tasks_current_period on tasks(current_period);
