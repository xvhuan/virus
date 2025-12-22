# 流感监测站

基于中国国家流感中心"流感周报"，自动抓取、AI 总结、可视化展示。

## 服务器部署

### 1. 上传文件

只需上传 `backend` 目录到服务器：

```
backend/
├── dist/           # 后端编译产物
├── public/         # 前端静态文件
├── data/           # 数据目录（首次运行自动创建）
├── prompts/        # AI prompt 模板
├── package.json
└── .env            # 环境变量（需在服务器配置）
```

### 2. 服务器配置

```bash
cd backend

# 安装生产依赖
npm install --production

# 配置环境变量
cp .env.example .env
vim .env  # 填入 LLM_BASE_URL, LLM_API_KEY, LLM_MODEL 等
```

### 3. 启动服务

直接启动：
```bash
node dist/index.js
```

使用 PM2 守护进程（推荐）：
```bash
# 安装 PM2
npm install -g pm2

# 启动
pm2 start dist/index.js --name flu-monitor

# 查看日志
pm2 logs flu-monitor

# 设置开机自启
pm2 startup
pm2 save
```

### 4. Nginx 反向代理（可选）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 5. 定时同步

服务启动后会自动每小时同步一次。也可手动触发：

```bash
curl -X POST http://localhost:8787/api/sync
```

## 环境变量说明

| 变量 | 说明 | 示例 |
|------|------|------|
| PORT | 服务端口 | 8787 |
| LLM_BASE_URL | 大模型 API 地址 | https://api.openai.com/v1 |
| LLM_API_KEY | API 密钥 | sk-xxx |
| LLM_MODEL | 模型名称 | gpt-4o-mini |

## 免责声明

本项目展示的内容来自大模型对公开周报的总结，仅供参考，不构成医疗建议。如有症状请咨询医生。
