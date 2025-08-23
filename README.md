# danmaku
用于解析转换各大视频网站（芒果TV，腾讯视频，优酷视频，爱奇艺视频，哔哩哔哩）弹幕

修改原项目使解析出的弹幕为.xml直链 同时优化性能（虽然不知道有没有效果(´•༝•`)

# 依赖
- chai: 断言库
- mocha: 测试框架
- ejs: 模板引擎
- express: web框架

# 运行此项目
``` sh
npm install # 安装依赖
npm run dev # 本地运行
npm run test # 单元测试
```

# 环境变量配置

## 自定义域名配置

本项目支持通过环境变量自定义域名，特别适用于反向代理和容器化部署场景。

### 配置选项

1. **完整域名配置（推荐）**
   ```bash
   CUSTOM_DOMAIN=https://api.example.com
   ```

2. **分别配置协议和主机**
   ```bash
   CUSTOM_PROTOCOL=https
   CUSTOM_HOST=myapp.example.com
   ```

3. **强制HTTPS（反向代理场景）**
   ```bash
   FORCE_HTTPS=true
   ```

### 部署场景示例

**Docker + Nginx反向代理**
```bash
CUSTOM_DOMAIN=https://api.example.com
```

**云平台部署（如Heroku）**
```bash
CUSTOM_PROTOCOL=https
CUSTOM_HOST=myapp.herokuapp.com
```

**本地开发**
无需配置，保持默认行为。

详细配置请参考 `.env.example` 文件。

# Docker部署

本项目的Docker镜像支持以下架构：
- linux/amd64 (x86_64)
- linux/arm64 (aarch64)

可以使用以下命令拉取并运行Docker镜像：

```bash
# 拉取镜像
docker pull ghcr.io/wobuhui666/danmaku:latest

# 运行容器
docker run -d -p 3000:3000 ghcr.io/wobuhui666/danmaku:latest
```

Docker将自动为您的系统架构选择正确的镜像版本。

# 部署到fly.io
``` sh
curl -L https://fly.io/install.sh | sh #linux
iwr https://fly.io/install.ps1 -useb | iex #windows
export FLYCTL_INSTALL="/home/codespace/.fly"
export PATH="$FLYCTL_INSTALL/bin:$PATH"
flyctl auth login
flyctl deploy
```

# 部署到hf
``` dockerfile
FROM ghcr.io/wobuhui666/danmaku:latest
ENV PORT 7860
EXPOSE 7860
USER root
RUN mkdir -p /app/public/danmaku && chown -R node:node /app/public/danmaku
USER node
```

# fly.io常用命令
``` sh
flyctl logs
flyctl status
flyctl scale count 0
flyctl regions add sea
flyctl regions remove hkg
flyctl config env
flyctl secrets set DEBUG=true
flyctl ssh console
flyctl checks list
flyctl ssh sftp get /app/db/danmaku.db
```

# Node常用工具
```bash
npm outdated
npm update
```

# 性能提升
相比于旧版的Python项目，Node对于异步并发的处理能力更强。 Express框架的性能也比Python的Django要好很多。