# WorkTracker 工作追踪看板

替代 Excel 的智能任务提醒系统。周期性任务（行政/财务）跨月跨季度提醒，未做就一直提醒直至手动标记完成。所有完成记录在同一份系统里，不用再翻付款凭证。

## 功能
- 自动周期提醒（每月 X 号 / 每季度初末 / 每年初）
- 状态机：pending → done → 下一周期重置为 pending
- 历史完成记录可查
- 看板可视化（今日到期 / 本月本季待办 / 全部任务 / 已完成历史）
- 手动录入新任务、跳过、删除
- WorkBuddy automation 每天 9:00 自动扫描推送提醒

## 本地开发（立即可用）

**双击 `start.bat`** → 浏览器自动打开 `http://localhost:8888`

数据存在本地 `tasks.js`，不联网，零配置。关闭黑窗口即可停止。

## 部署到 Vercel（云端）

### 第 1 步：注册 Supabase + 建表

1. 打开 https://supabase.com 注册免费账号
2. 新建一个 Project（免费档够用）
3. 进入 SQL Editor，粘贴 `supabase-schema.sql` 全部内容，点 Run 执行
4. 进入 Project Settings → API，复制两个值：
   - `Project URL`（形如 `https://xxxx.supabase.co`）
   - `anon public` key

### 第 2 步：推到 GitHub

```bash
cd work-tracker
git init
git add .
git commit -m "init work tracker"
git branch -M main
# 然后在 GitHub 创建空仓库，按提示 push
git remote add origin https://github.com/你的用户名/work-tracker.git
git push -u origin main
```

### 第 3 步：Vercel 部署

1. 打开 https://vercel.com 用 GitHub 账号登录
2. New Project → Import 刚才的 `work-tracker` 仓库
3. Framework Preset 选 `Other`（保持默认）
4. **Environment Variables** 配两个：
   - `SUPABASE_URL` = 第 1 步复制的 Project URL
   - `SUPABASE_ANON_KEY` = 第 1 步复制的 anon key
5. Deploy → 几秒后拿到 URL（如 `https://work-tracker-xxx.vercel.app`）

部署完成后，访问 Vercel URL 即可使用云端版，数据存 Supabase，所有设备（手机/电脑）都能访问。

### 第 4 步：导入本地数据（可选）

如果你本地 `tasks.js` 已经录了几条任务想迁到云端，让我帮你写个一次性脚本，把本地数据批量 POST 到 Vercel 的 `/api/tasks`。

### 第 5 步：让 WorkBuddy automation 提醒云端数据

部署完成后，告诉我你的 Vercel URL，我会修改 automation，让它每天 9:00 fetch `https://你的域名/api/scan` 拿到期任务，在对话里推送提醒。

## 项目结构

```
work-tracker/
├── api/                       # Vercel Serverless Functions
│   ├── tasks.js               # GET/POST /api/tasks
│   ├── tasks/[id].js          # POST /api/tasks/:id?action=complete|skip|resume|delete|edit
│   └── scan.js                # GET /api/scan
├── lib/
│   └── storage.js             # 数据访问层（本地:文件 / Vercel:Supabase 自动切换）
├── public/
│   └── index.html             # 前端看板
├── server.js                  # 本地开发服务器（双击 start.bat 用，Vercel 不需要）
├── start.bat                  # 本地启动脚本
├── tasks.js                   # 本地数据文件（gitignore，含个人信息不上传）
├── supabase-schema.sql        # Supabase 建表脚本
├── package.json
├── vercel.json
├── .env.example               # 环境变量示例
└── .gitignore
```

## 数据流

```
本地开发：双击 start.bat → server.js + tasks.js（本地文件）
                        ↓
                Vercel 部署 → api/* functions + Supabase（云端）
                              ↑
                WorkBuddy automation 每天 9:00 → fetch /api/scan → 对话提醒
```

## 安全说明
- `.gitignore` 已忽略 `tasks.js`，本地数据不会被 push 到 GitHub
- Supabase 用 anon key + RLS policy 允许匿名读写（个人项目简化方案）
- 如果要更严格，可以加 Supabase Auth + 行级安全策略按用户隔离
