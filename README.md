# HHP 前端

Vue 3 + Vite + Element Plus。所有接口请求使用 **`/api` 前缀**，由 Nginx（生产）或 Vite 开发代理转发到 Flask（`127.0.0.1:5001`）。

## 本地开发

```bash
cd template
npm install
cp .env.example .env.development   # 默认 http://127.0.0.1:5001
# 另开终端启动后端
cd ../backend && python3 main.py
npm run dev
```

浏览器访问 `http://localhost:5173`，接口直连 `http://127.0.0.1:5001`（需后端已启动，且 Flask 已开启 CORS）。

## 生产构建

```bash
cp .env.production.example .env.production   # VITE_API_BASE_URL=/api
npm run build
```

产物在 `dist/`。

## 服务器部署

### 1. 上传静态资源

```bash
rsync -avz dist/ user@服务器:/var/www/hhp/web/
```

### 2. Nginx 配置（前端 + API 反代）

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/hhp/web;
    index index.html;

    # 前端 SPA
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API：/api/login -> http://127.0.0.1:5001/login
    location /api/ {
        proxy_pass http://127.0.0.1:5001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        client_max_body_size 20m;
    }
}
```

### 3. 启动后端

```bash
cd /var/www/hhp/backend
source .venv/bin/activate
gunicorn -w 4 -b 127.0.0.1:5001 main:app --timeout 120
```

### 4. 验证

```bash
curl -X POST http://yourdomain.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"account":"账号","password":"密码"}'
```

## 环境变量

| 环境 | 文件 | `VITE_API_BASE_URL` |
|------|------|---------------------|
| 开发 `npm run dev` | `.env.development` | `http://127.0.0.1:5001` |
| 生产 `npm run build` | `.env.production` | `/api`（Nginx 反代） |

修改环境变量后需重新执行 `npm run dev` 或 `npm run build`。
