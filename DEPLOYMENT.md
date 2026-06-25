# Regional Potential Lab 部署说明

目标链路：

```text
GitHub 私有仓库
  -> Render Singapore 运行 Streamlit
  -> Cloudflare DNS / HTTPS
  -> https://regional-potential-lab.com
```

## 1. Render Singapore 部署

推荐使用 Render Blueprint，因为仓库根目录已经包含 `render.yaml`。

1. 登录 Render Dashboard。
2. 选择 **New +** → **Blueprint**。
3. 连接 GitHub 私有仓库：`https://github.com/LYN169/-Vibcode-coding.git`。
4. 选择 `main` 分支。
5. Render 会读取 `render.yaml` 并创建 Web Service：
   - service name: `regional-potential-lab`
   - runtime: Python
   - region: Singapore
   - plan: Free
   - build command: `pip install --upgrade pip && pip install -r requirements.txt && pip install -r requirements-spatial.txt`
   - start command: `streamlit run app.py --server.port $PORT --server.address 0.0.0.0 --server.headless true --browser.gatherUsageStats false`
6. 如果 Free 实例因内存或构建时间失败，把 Render 服务升级到 Starter 后重新部署。

部署成功后，Render 会生成一个类似下面的默认域名：

```text
https://regional-potential-lab.onrender.com
```

后续 Cloudflare DNS 的 CNAME 目标以 Render 后台显示的实际 `onrender.com` 域名为准。

## 2. 在 Render 添加自定义域名

在 Render 的 `regional-potential-lab` 服务页面：

1. 打开 **Settings**。
2. 找到 **Custom Domains**。
3. 添加根域名：

```text
regional-potential-lab.com
```

Render 通常会自动关联对应的 `www` 子域名跳转关系。添加后先不要急着在 Cloudflare 开橙云代理，先按 Render 要求配置 DNS 并等待证书签发。

## 3. Cloudflare DNS 设置

前提：`regional-potential-lab.com` 已经添加到 Cloudflare，并且域名注册商处的 Nameserver 已切换为 Cloudflare 提供的两个 NS。

在 Cloudflare → `regional-potential-lab.com` → **DNS** → **Records** 中添加：

| Type | Name | Target | Proxy status |
|---|---|---|---|
| CNAME | `@` | Render 的 `onrender.com` 域名 | DNS only |
| CNAME | `www` | Render 的 `onrender.com` 域名 | DNS only |

注意：

- 先删除同名的 `A`、`AAAA` 记录，尤其是 `AAAA`，避免影响 Render 证书验证。
- Cloudflare → **SSL/TLS** → **Overview** 设置为 `Full`。
- Render 显示证书签发成功、域名可访问后，可以把两个 CNAME 从 **DNS only** 切到 **Proxied**。
- Streamlit 使用 WebSocket，Cloudflare 支持 WebSocket，但如果代理后出现连接不稳定，先切回 **DNS only** 验证。

## 4. Railway 备用部署

仓库也提供了 `railway.json`。如果 Render 在构建 GeoPandas/空间依赖时失败，可以在 Railway 新建项目并连接同一 GitHub 私仓：

1. New Project → Deploy from GitHub repo。
2. 选择 `LYN169/-Vibcode-coding`。
3. 区域选择 Singapore。
4. Railway 会读取 `railway.json` 的 build/start command。
5. 生成 Railway 域名后，再在 Cloudflare 中把 CNAME Target 改成 Railway 域名。

## 5. 数据说明

当前 GitHub 仓库不包含大体积 `outputs/real_data_v2` 和旧版 `outputs/processed` 结果。线上应用默认使用 `sample/` 示例数据跑通完整页面。

如需线上读取真实数据，有两种方式：

1. 在网页侧栏上传 CSV/GeoJSON 文件；
2. 将真实数据文件提交到 `data/`，但这会把数据放入私仓和部署包，需确认数据版权、隐私与体积。

## 6. 常见问题

### 构建失败

优先检查 Render logs。GeoPandas / PySAL / esda 依赖较重，Free 实例可能构建慢或内存不足。可尝试：

- 升级 Render Starter；
- 如果只需要地图和指标、暂时不需要 Moran's I / LISA，可临时移除 `requirements.txt` 中的 `libpysal` 和 `esda`，空间分析会自动降级为“暂不可用”；
- 使用 Railway 备用部署。

### 线上提示 `No module named 'esda'`

说明 Render 当前构建没有安装空间分析依赖。常见原因是手动创建 Web Service 时只用了旧版 `requirements.txt`，或服务创建早于空间依赖并入主依赖。

处理方式：

1. 确认最新代码已经包含 `requirements.txt` 中的 `libpysal` 和 `esda`。
2. 在 Render 服务页面点击 **Manual Deploy** → **Clear build cache & deploy**。
3. 如果你没有使用 Blueprint，请把 Build Command 至少设置为：

```bash
pip install --upgrade pip && pip install -r requirements.txt
```

Blueprint 方式仍可保留：

```bash
pip install --upgrade pip && pip install -r requirements.txt && pip install -r requirements-spatial.txt
```

### 页面能打开但地图不显示

检查浏览器控制台、Render logs，以及 Streamlit 是否成功读取 `sample/` 或上传数据。若 Cloudflare 已开启 Proxied，先切回 DNS only 排查 WebSocket。

### 国内访问不稳定

Render Singapore + Cloudflare 比欧美源站更适合国内展示，但仍不是中国大陆境内服务，不能保证所有运营商稳定访问。答辩或正式展示建议准备本地运行备份：

```powershell
cd regional_potential_lab
streamlit run app.py
```
