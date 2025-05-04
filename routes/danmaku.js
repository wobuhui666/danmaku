const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const URL = require("url");
const {
    bilibili,
    mgtv,
    tencentvideo,
    youku,
    iqiyi
} = require("./api/base");
const list = [bilibili, mgtv, tencentvideo, youku, iqiyi];
const memory = require("../utils/memory");
const db = require("../utils/db");

// 返回对象{msg: "ok", title: "标题", content: []}
async function build_response(url, req) {
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
            headers: { "Accept-Encoding": "gzip,deflate,compress" }
        });
    } catch (e) {
        console.log(e);
        return { msg: "传入的链接非法！请检查链接是否能在浏览器正常打开" };
    }
    // 循环找到对应的解析器
    let fc = undefined;
    for (let item of list) {
        if (url.indexOf(item.domain) !== -1) {
            fc = item;
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
    memory(); // 显示内存使用量

    if (ret.msg !== "ok") {
        res.status(403).send(ret.msg);
        return;
    }

    // 记录视频信息
    db.videoInfoInsert({ url, title: ret.title });

    // 弹幕内容生成 XML 文件
    const xmlFileName = `${ret.title}.xml`.replace(/[^a-zA-Z0-9_\-\.]/g, "_"); // 确保文件名安全
    const xmlFilePath = path.join(__dirname, "../public/xml", xmlFileName);

    try {
        // 创建 public/xml 文件夹（如果不存在）
        if (!fs.existsSync(path.dirname(xmlFilePath))) {
            fs.mkdirSync(path.dirname(xmlFilePath), { recursive: true });
        }

        // 写入 XML 文件
        const xmlContent = `
        <?xml version="1.0" encoding="UTF-8"?>
        <i>
            ${ret.content.map(item => `<d p="${item.p}">${item.text}</d>`).join("\n")}
        </i>
        `;
        fs.writeFileSync(xmlFilePath, xmlContent, { encoding: "utf-8" });
    } catch (err) {
        console.error("Failed to save XML file:", err);
        res.status(500).send("服务器错误：无法生成 XML 文件");
        return;
    }

    // 返回文件的直链
    const publicUrl = `${req.protocol}://${req.headers.host}/xml/${xmlFileName}`;
    res.send({ msg: "ok", url: publicUrl });
}

async function index(req, res) {
    const urls = [mgtv.example_urls[0], bilibili.example_urls[0], tencentvideo.example_urls[0], youku.example_urls[0], iqiyi.example_urls[0]];
    const path = req.protocol + "://" + req.headers.host + req.originalUrl;
    const resolve_info = await db.accessCountQuery();
    const hotlist = await db.hotlistQuery();
    res.render("danmaku", {
        path,
        urls,
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
    });
    // 检查是否包含 URL 参数
    if (!req.query.url) index(req, res); else resolve(req, res);
});

router.get("/delete", async function (req, res) {
    const rows = await db.deleteAccess();
    res.send(`删除三个月以前的记录，删除了${rows}条记录`);
});

module.exports = router;