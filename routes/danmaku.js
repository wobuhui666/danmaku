const express = require("express");
const axios = require("axios");
const router = express.Router();
const URL = require("url");
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
        
        // 缓存结果
        if (ret.msg === "ok") {
            if (!global.danmakuCache) global.danmakuCache = {};
            global.danmakuCache[cacheKey] = ret;
            
            // 设置缓存过期时间（24小时）
            setTimeout(() => {
                if (global.danmakuCache && global.danmakuCache[cacheKey]) {
                    delete global.danmakuCache[cacheKey];
                }
            }, 24 * 60 * 60 * 1000);
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
	const download = (req.query.download === "on");
	const ret = await build_response(url, req);
	memory(); //显示内存使用量
	if (ret.msg !== "ok") {
		res.status(403).send(ret.msg);
		return;
	}
	
	// 记录视频信息
	db.videoInfoInsert({url,title:ret.title})
	
	//B站视频，直接重定向
	if (ret.url) {
		res.redirect(ret.url);
	} else {
		// 设置响应头为XML类型
		res.type("application/xml");
		res.set('Cache-Control', 'public, max-age=86400'); // 缓存一天
		
		// 始终设置为下载附件，提供直链
		res.attachment(ret.title + ".xml");
		
		// 直接构建XML字符串而不是渲染模板
		let xmlContent = '<?xml version="1.0" encoding="utf-8"?>\n<i>\n';
		for (const content of ret.content) {
			xmlContent += `    <d p="${content.timepoint},${content.ct},${content.size},${content.color},${content.unixtime},0,${content.uid},26732601000067074,1">${content.content}</d>\n`;
		}
		xmlContent += '</i>';
		
		// 发送XML内容
		res.send(xmlContent);
	}
}

async function index(req, res) {
	const urls = list.map(item => item.example_urls[0]);
	const names = list.map(item => item.name);
	const path = req.protocol + "://" + req.headers.host + req.originalUrl;
	const resolve_info = await db.accessCountQuery()
	const hotlist = await db.hotlistQuery()
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
    // 异步执行数据库插入，不阻塞响应
    db.accessInsert({
        ip: req.ip,
        url: req.query.url,
        UA: req.headers["user-agent"]
    }).catch(err => console.error("DB access insert error:", err));
    
    //检查是否包含URL参数
    if (!req.query.url) index(req, res); else resolve(req, res);
});
router.get("/delete", async function (req, res) {
	const rows = db.deleteAccess();
	res.send(`成功请求删除三个月以前的记录，删除情况请查看日志`);
});

module.exports = router;
