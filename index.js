// Vercel 入口文件 - 实际不被访问
// 所有路径由 api/ functions 和 public/ 静态资源处理
// 这个文件只是让 Vercel 满意（它检测到 package.json + dependencies 强制要找入口）
module.exports = (req, res) => {
  res.status(404).json({ error: 'Not found' });
};
