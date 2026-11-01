# WeHelp 前端

Vue 3 + Vite + Element Plus 的 CRM / 项目管理前端。

- 所有接口请求统一走 **`/api` 前缀**（生产环境由 Nginx 反向代理到后端 Flask 服务）。
- 开发环境通过 `.env.development` 直连本地后端 `http://127.0.0.1:5002`。
- 生产环境通过 `.env.production` 使用同源 `/api`，由服务器上的 Nginx 转发。

---

## 目录

- [1. 技术栈与目录结构](#1-技术栈与目录结构)
- [2. 本地开发](#2-本地开发)
- [3. 生产构建](#3-生产构建)
- [4. 服务器部署（前端 scp 上传）](#4-服务器部署前端-scp-上传)
  - [4.1 服务器现状](#41-服务器现状)
  - [4.2 Nginx 配置（多站点前缀形式）](#42-nginx-配置多站点前缀形式)
  - [4.3 部署步骤](#43-部署步骤推荐先传临时目录再原子替换)
  - [4.4 简化版部署](#44-简化版部署一步到位)
  - [4.5 Nginx 配置改为多站点前缀形式](#45-nginx-配置改为多站点前缀形式一次性需-sudo)
  - [4.6 前端需要改的 base 配置](#46-前端需要改的-base-配置配合前缀部署)
  - [4.7 验证清单](#47-验证清单)
- [5. 后端部署（含 ensurepip 报错处理）](#5-后端部署含-ensurepip-报错处理)
- [6. 完整发布流程（一条龙）](#6-完整发布流程一条龙)
- [7. 环境变量](#7-环境变量)
- [8. 常见问题排查](#8-常见问题排查)

---

## 1. 技术栈与目录结构

| 项 | 值 |
|----|----|
| 框架 | Vue 3（`<script setup>`） |
| 构建 | Vite 5 |
| UI | Element Plus 2.9（按需自动引入） |
| 状态管理 | Pinia + pinia-plugin-persistedstate |
| 路由 | Vue Router 4（history 模式） |
| 图表 | ECharts 5 + vue-echarts |
| HTTP | Axios（`src/utils/http.js`） |

```
WeHelp-Frontend/
├── src/
│   ├── apis/                 # 接口定义（apis/crm.js 等）
│   ├── components/           # 通用组件
│   ├── composables/
│   ├── constants/
│   ├── router/index.js       # 路由表
│   ├── stores/               # Pinia store
│   ├── styles/               # 全局样式 / element 主题覆盖
│   ├── utils/http.js         # axios 实例与拦截器
│   └── views/
│       ├── Layout/           # 整体布局
│       ├── Login/
│       ├── Home/
│       ├── Project/
│       └── Crm/
│           ├── CrmList/
│           │   ├── index.vue                    # 客户列表
│           │   └── components/
│           │       ├── CrmFilterBar.vue         # 筛选栏
│           │       ├── CrmListDetail.vue        # 客户详情
│           │       ├── CrmCreateCustomerDialog.vue
│           │       └── shared.js                # 下拉选项 / 深入分析映射
│           ├── CrmContact/
│           └── CrmFollowUpRecords/
├── .env.development           # 本地开发后端地址
├── .env.production            # 生产环境后端地址（需自行创建）
├── vite.config.js
└── package.json
```

---

## 2. 本地开发

```bash
# 1. 安装依赖
cd /Users/pzj/Documents/WeHelp-Frontend
npm install

# 2. 确认开发环境变量（已存在则跳过）
cat .env.development
#   VITE_API_BASE_URL=http://127.0.0.1:5002

# 3. 另开终端启动后端
cd /Users/pzj/Documents/WeHelp-Backend
source venv313/bin/activate        # 本地虚拟环境
python main.py

# 4. 启动前端
cd /Users/pzj/Documents/WeHelp-Frontend
npm run dev
```

访问 `http://localhost:5173`。

> 后端未启动时接口会报错；后端需允许跨域（Flask-CORS），
> 或改用 `vite.config.js` 中的 proxy 转发。

---

## 3. 生产构建

```bash
cd /Users/pzj/Documents/WeHelp-Frontend

# 生产环境走同源路径，由 Nginx 反代到 127.0.0.1:5001
cat .env.production
#   VITE_API_BASE_URL=/api            # 根路径部署（当前线上）
#   VITE_API_BASE_URL=/wehelp/api     # 前缀部署，见 4.6

# 安装依赖 + 构建
npm install
npm run build
```

产物输出到 `dist/`：

```
dist/
├── index.html
├── favicon.ico
└── assets/
    ├── index-xxxx.css
    ├── index-xxxx.js
    └── login-bg-xxxx.jpeg
```

> ⚠️ 每次构建后 `assets/` 里的文件名带 hash 会变，
> 部署时必须**整体替换** `assets` 目录，不能只覆盖单个文件。

---

## 4. 服务器部署（前端 scp 上传）

### 4.1 服务器现状

| 项 | 值 |
|----|----|
| 服务器 IP | `39.105.51.60` |
| 访问地址 | `http://39.105.51.60/wehelp/`（域名 `pzj.life`） |
| SSH 用户 | `pzj` |
| Nginx 站点配置 | `/etc/nginx/conf.d/vue-project.conf` |
| 站点前缀 | `/wehelp/` |
| 前端站点根目录 | `/home/pzj/WeHelp-Frontend`（产物在 `wehelp/` 子目录：`wehelp/index.html` 与 `wehelp/assets/` 同级） |
| 静态文件服务 | Nginx `alias` 托管 `/home/pzj/WeHelp-Frontend/wehelp/` |
| 页面路由 | 前端 `base: '/wehelp/'`，登录页 `/wehelp/login` |
| API 反代 | `/api/` → `http://127.0.0.1:5001/`（**根路径**，只提供数据，与页面路由无关） |
| 后端代码目录 | `/home/pzj/WeHelp-Backend` |

### 4.2 Nginx 配置（多站点前缀形式）

同一台服务器后续可能部署多个站点，统一按「前缀 + 独立端口」的形式组织：
`location /<站点前缀>/` 指向各自的静态文件目录，`<站点前缀>/api/` 反代到各自的后端端口。

```nginx
server {
    listen 80;
    server_name pzj.life;

  

    # ---------- 站点三：WeHelp（CRM 前端） ----------
    location /wehelp/ {
        alias /home/pzj/WeHelp-Frontend/;
        index index.html;
        try_files $uri $uri/ /wehelp/index.html;
    }

    location /wehelp/api/ {
        proxy_pass http://127.0.0.1:5001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 20m;
    }
      # ---------- 站点一：example ----------
    #location /site1/ {
    #    alias /home/pzj/site1/;
    #    index index.html;
    #    # SPA history 模式，刷新不 404
    #    try_files $uri $uri/ /site1/index.html;
    #}
#
    #location /site1/api/ {
    #    proxy_pass http://127.0.0.1:8001/;
    #    proxy_set_header Host $host;
    #    proxy_set_header X-Real-IP $remote_addr;
    #    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    #    proxy_set_header X-Forwarded-Proto $scheme;
    #}

    # ---------- 站点二：example ----------
    #location /site2/ {
    #    alias /home/pzj/site2/;
    #    index index.html;
    #    try_files $uri $uri/ /site2/index.html;
    #}
#
    #location /site2/api/ {
    #    proxy_pass http://127.0.0.1:8002/;
    #    proxy_set_header Host $host;
    #    proxy_set_header X-Real-IP $remote_addr;
    #    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    #    proxy_set_header X-Forwarded-Proto $scheme;
    #}
}
```

> Nginx 按**最长前缀**匹配，`/wehelp/api/` 会优先于 `/wehelp/` 命中，
> 所以 `/wehelp/` 的 `alias` 不会把 API 请求吞掉。

### 4.3 部署步骤（推荐：先传临时目录，再原子替换）

```bash
cd /Users/pzj/Documents/WeHelp-Frontend

# 1. 构建（base 需与站点前缀一致，见 4.6）
npm run build

# 2. 上传到服务器临时目录（避免直接覆盖线上目录导致半成品）
ssh pzj@39.105.51.60 "rm -rf /tmp/wehelp-web-deploy && mkdir -p /tmp/wehelp-web-deploy"
scp -r dist/* pzj@39.105.51.60:/tmp/wehelp-web-deploy/

# 3. 服务器上：备份旧版本 → 替换新版本（产物放在 wehelp/ 子目录）
ssh pzj@39.105.51.60 '
  set -e
  cd /home/pzj/WeHelp-Frontend
  TS=$(date +%Y%m%d_%H%M%S)
  tar -czf "/home/pzj/WeHelp-Frontend_bak_${TS}.tar.gz" wehelp 2>/dev/null || true
  rm -rf wehelp
  mkdir -p wehelp
  cp -r /tmp/wehelp-web-deploy/* wehelp/
  # 根目录留一份 index.html，供 Nginx try_files 兜底（history 模式深链接回退）
  cp wehelp/index.html index.html
  cp wehelp/favicon.ico favicon.ico
  rm -rf /tmp/wehelp-web-deploy
  ls -la
'

# 4. 重载 Nginx（静态文件替换通常无需重载，配置有改动时才需要）
ssh pzj@39.105.51.60 "sudo nginx -t && sudo nginx -s reload"

# 5. 验证
curl -o /dev/null -s -w "index:%{http_code}\n" http://39.105.51.60/wehelp/
curl -o /dev/null -s -w "api:%{http_code}\n"  http://39.105.51.60/api/login
```

### 4.4 简化版部署（一步到位）

适用于改动不大、可以接受短暂不一致的场景：

```bash
cd /Users/pzj/Documents/WeHelp-Frontend
npm run build
scp -r dist/* pzj@39.105.51.60:/home/pzj/WeHelp-Frontend/wehelp/
ssh pzj@39.105.51.60 "sudo nginx -s reload"
```

### 4.5 Nginx 配置改为多站点前缀形式（一次性，需 sudo）

Nginx 配置文件属 `root`，当前 `pzj` 用户没有免密 sudo，需在服务器上手动执行一次：

```bash
ssh pzj@39.105.51.60

# 备份配置
sudo cp /etc/nginx/conf.d/vue-project.conf /etc/nginx/conf.d/vue-project.conf.bak

# 编辑成 4.2 的多站点前缀形式，然后校验并重载
sudo nginx -t && sudo nginx -s reload
```

> 已用软链接做过平滑过渡：`/home/pzj/dist` → `/home/pzj/WeHelp-Frontend`。
> 改成前缀形式后软链接不再需要，可清理：`rm -rf /home/pzj/dist_real_* /home/pzj/dist_bak_* /home/pzj/dist`。
>
> **页面路由前缀与 API 路径是两回事**：
> - 页面路由（`/wehelp/login`、`/wehelp/crm/list`）由前端 `base` 决定，需要 Nginx 的 `location /wehelp/`；
> - API（`/api/login`）只是给前端提供数据，保持根路径即可，与站点前缀无关。

### 4.6 前端需要改的 base 配置（配合前缀部署）

部署到 `/wehelp/` 前缀时，只需改**前端 `base`**（决定页面路由和静态资源路径）：

```bash
# vite.config.js —— 已配置
export default defineConfig({
  base: '/wehelp/',
  ...
})
```

`src/router/index.js` 用的是 `createWebHistory(import.meta.env.BASE_URL)`，
会自动读取上面的 `base`，**不需要另外改**。

`.env.production` 的 `VITE_API_BASE_URL` 保持 `/api`（根路径，只提供数据，与页面路由无关）。

改完 `base` 后重新 `npm run build` 再上传。

### 4.7 验证清单

```bash
# 站点首页可访问
curl -s http://39.105.51.60/wehelp/ | head -5

# 静态资源可访问（hash 文件名以实际构建输出为准）
curl -o /dev/null -s -w "%{http_code}\n" http://39.105.51.60/wehelp/assets/index-xxxx.js

# 接口联通（登录接口返回 200/401 说明 Nginx → Flask 链路通，API 在根路径）
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://39.105.51.60/api/login \
  -H "Content-Type: application/json" \
  -d '{"account":"账号","password":"密码"}'

# 前端路由刷新不 404
curl -o /dev/null -s -w "%{http_code}\n" http://39.105.51.60/wehelp/crm/list
```

浏览器打开 `http://39.105.51.60/wehelp/`，强制刷新（`Cmd+Shift+R`）确认新版本生效。

---

## 5. 后端部署（含 ensurepip 报错处理）

### 5.1 现状

| 项 | 值 |
|----|----|
| 后端代码目录 | `/home/pzj/WeHelp-Backend` |
| 虚拟环境 | `/home/pzj/WeHelp-Backend/WeHelp`（由 **uv** 创建，Python 3.13.18） |
| systemd 服务 | `wehelp-backend.service` |
| 监听端口 | `0.0.0.0:5001` |

systemd 单元（`/etc/systemd/system/wehelp-backend.service`）：

```ini
[Unit]
Description=WeHelp Backend Flask API
After=network.target

[Service]
Type=simple
User=pzj
Group=pzj
WorkingDirectory=/home/pzj/WeHelp-Backend
Environment="PATH=/home/pzj/WeHelp-Backend/WeHelp/bin"
EnvironmentFile=/home/pzj/WeHelp-Backend/.env
ExecStart=/home/pzj/WeHelp-Backend/WeHelp/bin/gunicorn -b 0.0.0.0:5001 -w 4 main:app --timeout 300
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 5.2 常见报错：`ensurepip` 返回非零

```
Error: Command '['/home/pzj/WeHelp-Backend/WeHelp/bin/python3.13', '-m', 'ensurepip',
'--upgrade', '--default-pip']' returned non-zero exit status 1.
```

**原因**：该虚拟环境由 `uv` 创建（`pyvenv.cfg` 里 `uv = 0.13.6`）。
uv 创建的环境不带 `ensurepip` 的 bundled wheels，
`python -m venv` / `python -m ensurepip` 在这种环境下会失败。

**处理方式（按推荐顺序）**：

```bash
ssh pzj@39.105.51.60

# 方案 A：用 uv 重建/同步环境（服务器已装 uv 0.13.6）——最贴合当前环境
cd /home/pzj/WeHelp-Backend
uv venv --python 3.13 WeHelp
uv pip install -r requirements.txt --python WeHelp/bin/python

# 方案 B：uv 不可用时，改用标准库 venv + get-pip.py
cd /home/pzj/WeHelp-Backend
python3.13 -m venv --without-pip WeHelp_tmp
curl -sS https://bootstrap.pypa.io/get-pip.py -o /tmp/get-pip.py
WeHelp_tmp/bin/python /tmp/get-pip.py
WeHelp_tmp/bin/python -m pip install -r requirements.txt
mv WeHelp WeHelp_old && mv WeHelp_tmp WeHelp

# 方案 C：环境里已有 pip，只是 ensurepip 报非零，直接用 pip 装依赖
cd /home/pzj/WeHelp-Backend
./WeHelp/bin/python -m pip install -r requirements.txt
```

> 说明：在实测中该 venv 内的 `python -m ensurepip --upgrade --default-pip` 实际是**正常返回 0** 的，
> 说明报错多半出现在**重建环境**的过程中（如临时目录、只读目录、或 pip 缓存损坏）。
> 排查时先确认报错的具体触发命令，多数情况下方案 A/C 可直接解决。

### 5.3 更新后端代码并重启

```bash
# 1. 本地上传后端代码（排除虚拟环境与缓存）
cd /Users/pzj/Documents/WeHelp-Backend
rsync -avz --exclude 'venv*' --exclude 'WeHelp/' --exclude '__pycache__/' \
  --exclude '*.pyc' --exclude '.env' \
  ./ pzj@39.105.51.60:/home/pzj/WeHelp-Backend/

# 2. 服务器上安装依赖（如有变动）
ssh pzj@39.105.51.60 "cd /home/pzj/WeHelp-Backend && ./WeHelp/bin/python -m pip install -r requirements.txt"

# 3. 重启服务
ssh pzj@39.105.51.60 "sudo systemctl restart wehelp-backend && sudo systemctl status wehelp-backend"

# 4. 看日志
ssh pzj@39.105.51.60 "sudo journalctl -u wehelp-backend -n 100 --no-pager"
```

---

## 6. 完整发布流程（一条龙）

```bash
cd /Users/pzj/Documents/WeHelp-Frontend

# ---------- 前端 ----------
npm run build

ssh pzj@39.105.51.60 "rm -rf /tmp/wehelp-web-deploy && mkdir -p /tmp/wehelp-web-deploy"
scp -r dist/* pzj@39.105.51.60:/tmp/wehelp-web-deploy/

ssh pzj@39.105.51.60 '
  set -e
  cd /home/pzj/WeHelp-Frontend
  rm -rf wehelp
  mkdir -p wehelp
  cp -r /tmp/wehelp-web-deploy/* wehelp/
  cp wehelp/index.html index.html
  cp wehelp/favicon.ico favicon.ico
  rm -rf /tmp/wehelp-web-deploy
'

# ---------- 后端（有代码改动时执行） ----------
# rsync -avz --exclude "venv*" --exclude "WeHelp/" --exclude "__pycache__/" \
#   --exclude "*.pyc" --exclude ".env" \
#   /Users/pzj/Documents/WeHelp-Backend/ pzj@39.105.51.60:/home/pzj/WeHelp-Backend/
# ssh pzj@39.105.51.60 "cd /home/pzj/WeHelp-Backend && ./WeHelp/bin/python -m pip install -r requirements.txt"

# ---------- 重启与验证 ----------
ssh pzj@39.105.51.60 "sudo systemctl restart wehelp-backend"
ssh pzj@39.105.51.60 "sudo nginx -t && sudo nginx -s reload"

curl -o /dev/null -s -w "index:%{http_code}\n" http://39.105.51.60/wehelp/
curl -o /dev/null -s -w "api:%{http_code}\n"  http://39.105.51.60/api/login
```

---

## 7. 环境变量

| 环境 | 文件 | `VITE_API_BASE_URL` |
|------|------|---------------------|
| 开发 `npm run dev` | `.env.development` | `http://127.0.0.1:5001` |
| 生产 `npm run build` | `.env.production` | `/api`（根路径，**与页面路由前缀无关**） |

> 生产环境后端监听 `0.0.0.0:5001`，但**该端口未在阿里云安全组放通，外网不可直连**
> （实测连接超时，仅 80 / 22 通）。因此前端必须走同源路径，
> 由 Nginx 在服务器内部转发到 `127.0.0.1:5001`，无需对外暴露后端端口。
>
> **页面路由前缀**（`/wehelp/`）由 `vite.config.js` 的 `base` 控制，
> **API 路径**（`/api`）由 `VITE_API_BASE_URL` 控制，两者相互独立：
> - 换站点前缀 → 只改 `vite.config.js` 的 `base`；
> - 换后端端口 → 只改 Nginx 的 `proxy_pass` 和 `.env.development`。

修改环境变量后需重新执行 `npm run dev` 或 `npm run build`。
Vite 只在构建时注入 `import.meta.env.*`，运行时改文件不生效。

---

## 8. 常见问题排查

| 现象 | 原因 / 处理 |
|------|-------------|
| 页面白屏、JS 404 | `wehelp/assets/` 未整体替换，或 Nginx 缓存 → 备份后 `rm -rf wehelp` 再整体拷贝；浏览器强制刷新 |
| 刷新 `/wehelp/crm/list` 返回 404 | Nginx 缺 `try_files $uri $uri/ /wehelp/index.html;`，或 `vite.config.js` 的 `base` 没改成 `/wehelp/` |
| 访问 `/wehelp/` 跳到了根路径 `/login` | `base` 没生效：确认 `vite.config.js` 里 `base: '/wehelp/'` 且重新 build 过 |
| 静态资源 404（JS/CSS） | 构建产物没带前缀：检查 `dist/index.html` 里是否引用 `/wehelp/assets/...` |
| 接口全部 502 / 超时 | 后端未启动：`sudo systemctl status wehelp-backend`；Nginx `proxy_pass` 端口与 gunicorn `-b` 端口需一致（5001） |
| 接口报 CORS | 生产走同源 `/wehelp/api` 不需要跨域；开发时后端需开 Flask-CORS |
| 前端请求 5001 超时 | 后端端口未对外放通是**预期**的，生产请用 `/wehelp/api`；`.env.production` 不要写成 `http://39.105.51.60:5001` |
| `ensurepip` 非零退出 | 见 [5.2](#52-常见报错ensurepip-返回非零)，优先用 `uv venv` 重建 |
| 后端启动报依赖缺失 | `cd /home/pzj/WeHelp-Backend && ./WeHelp/bin/python -m pip install -r requirements.txt` |
| 想回滚前端 | 备份包在 `/home/pzj/WeHelp-Frontend_bak_<时间戳>.tar.gz`（旧版本目录 `/home/pzj/dist_real_*`、`/home/pzj/dist_bak_*`）：<br>`ssh pzj@39.105.51.60 "cd /home/pzj/WeHelp-Frontend && tar -xzf ../WeHelp-Frontend_bak_<时间戳>.tar.gz"`，再 `sudo nginx -s reload` |
