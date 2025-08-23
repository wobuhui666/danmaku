const express = require("express");
const axios = require("axios");
const router = express.Router();
const URL = require("url");
const fs = require("fs"); // 引入：文件系统模块
const path = require("path"); // 引入：路径处理模块
const crypto = require("crypto"); // 引入：加密模块，用于生成唯一文件名
const { buildPublicUrl } = require("../utils/domain"); // 引入：域名配置工具

const {
	bilibili,
	mgtv,
	tencentvideo,
	youku,
	iqiyi,
	gamer,
} = require("./api/base");
const list = [bilibili, mgtv, tencentvideo, youku, iqiyi, gamer];
const memory = require("../utils/memory");
const db = require("../utils/db");

// 定义服务器上存放XML缓存文件的物理目录路径
const DANMAKU_CACHE_DIR = path.join(__dirname, '..', 'public', 'danmaku');

// 程序启动时，检查并确保该缓存目录存在，如果不存在则自动创建
if (!fs.existsSync(DANMAKU_CACHE_DIR)) {
    console.log(`正在创建弹幕缓存目录: ${DANMAKU_CACHE_DIR}`);
    fs.mkdirSync(DANMAKU_CACHE_DIR, { recursive: true });
}

// 返回对象{msg: "ok", title: "标题", content: []}
async function build_response(url, req) {
    // 添加内存缓存检查
    const cacheKey = `danmaku_${url}`;
    const cachedResult = global.danmakuCache ? global.danmakuCache[cacheKey] : null;
    if (cachedResult) {
        console.log("Using cached result for:", url);
        return cachedResult;
    }
    
    // 循环找最终url
    for (let q = new URLSearchParams(URL.parse(url).query); q.has("url");) {
        console.log("Redirecting to", url);
        url = q.get("url");
        q = new URLSearchParams(URL.parse(url).query);
    }
    console.log("Real url:", url);
    
    // 测试url是否能下载
    try {
        await axios.get(url, {
            headers: { "Accept-Encoding": "gzip,deflate,compress" },
            timeout: 5000 // 添加超时设置
        });
    } catch (e) {
        console.log(e);
        // 如果是 403 错误，不报错，继续执行
        if (e.response && e.response.status === 403) {
            console.log("访问视频页面 403 错误，有可能被防火墙拦了");
        } else {
            return { msg: "传入的链接非法！请检查链接是否能在浏览器正常打开" };
        }
    }
    
    // 循环找到对应的解析器
    let fc = undefined;
    for (let item of list) {
        if (url.indexOf(item.domain) !== -1) {
            fc = item;
            break; // 找到后立即跳出循环
        }
    }
    
    // 找不到对应的解析器
    if (fc === undefined) {
        return { "msg": "不支持的视频网址" };
    }
    
    // 捕获所有错误并添加日志
    let ret;
    try {
        ret = await fc.work(url);
        
        // 缓存结果 (内存缓存)
        if (ret.msg === "ok") {
            if (!global.danmakuCache) global.danmakuCache = {};
            global.danmakuCache[cacheKey] = ret;
            
            setTimeout(() => {
                if (global.danmakuCache && global.danmakuCache[cacheKey]) {
                    delete global.danmakuCache[cacheKey];
                }
            }, 24 * 60 * 60 * 1000); // 24小时后过期
        }
    } catch (e) {
        console.log(e);
        let err = JSON.stringify(e, Object.getOwnPropertyNames(e));
        db.errorInsert({
            ip: req.ip,
            url,
            err
        });
        return { msg: "弹幕解析过程中程序报错退出，请等待管理员修复！或者换条链接试试！" };
    }
    return ret;
}

async function resolve(req, res) {
	const url = req.query.url;
	const ret = await build_response(url, req);
	memory(); //显示内存使用量
	if (ret.msg !== "ok") {
		res.status(403).send(ret.msg);
		return;
	}
	
	db.videoInfoInsert({url, title: ret.title});
	
	// ---- 核心逻辑修改 ----

	// 1. 【Bilibili 逻辑】检查解析器是否直接返回了URL (这是为B站保留的原始逻辑)
	if (ret.url) {
		console.log(`Bilibili: 直接重定向到 ${ret.url}`);
		res.redirect(ret.url); // B站直接重定向
	} else {
		// 2. 【其他网站逻辑】生成XML文件，缓存到本地，然后重定向
		console.log(`其他网站: 为 "${ret.title}" 生成并缓存XML文件`);

        // 使用视频原始URL的MD5哈希值作为文件名，确保唯一且安全
        const hash = crypto.createHash('md5').update(url).digest('hex');
        const fileName = `${hash}.xml`;
        const filePath = path.join(DANMAKU_CACHE_DIR, fileName);

        // 检查XML文件是否已存在于硬盘上
        if (!fs.existsSync(filePath)) {
            console.log(`本地缓存未命中，正在生成文件: ${fileName}`);
            
            // 构建XML内容
            let xmlContent = '<?xml version="1.0" encoding="utf-8"?>\n<i>\n';
            for (const content of ret.content) {
                xmlContent += `    <d p="${content.timepoint},${content.ct},${content.size},${content.color},${content.unixtime},0,${content.uid},26732601000067074,1">${content.content}</d>\n`;
            }
            xmlContent += '</i>';

            // 将XML内容同步写入文件
            fs.writeFileSync(filePath, xmlContent);
        } else {
            console.log(`命中本地文件缓存: ${fileName}`);
        }

        // 构建可供外部浏览器访问的公开URL
        const publicUrl = `${req.protocol}://${req.get('host')}/danmaku/${fileName}`;
        
        // 执行302重定向到该XML文件的直链
        res.redirect(302, publicUrl);
	}
}

async function index(req, res) {
	const urls = list.map(item => item.example_urls[0]);
	const names = list.map(item => item.name);
	const path = req.protocol + "://" + req.headers.host + req.originalUrl;
	const resolve_info = await db.accessCountQuery();
	const hotlist = await db.hotlistQuery();
	res.render("danmaku", {
		path,
		urls,
		names,
		resolve_info,
		hotlist
	});
}

/* GET home page. */
router.get("/", async function (req, res) {
    db.accessInsert({
        ip: req.ip,
        url: req.query.url,
        UA: req.headers["user-agent"]
    }).catch(err => console.error("DB access insert error:", err));
    
    if (!req.query.url) {
        index(req, res);
    } else {
        resolve(req, res);
    }
});

router.get("/delete", async function (req, res) {
	db.deleteAccess();
	res.send(`成功请求删除三个月以前的记录，删除情况请查看日志`);
});

module.exports = router;