const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const compression = require('compression');
const fs = require("fs");
const schedule = require("node-schedule"); // 用于定时任务

// 引入环境变量
require("dotenv").config();

// 引入一个个路由模块
const danmakuRouter = require("./routes/danmaku");
const app = express();

// 启用gzip压缩
app.use(compression());

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.set("trust proxy", true);

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false, validate: { trustProxy: false } }));
app.use(cookieParser());

// 加载静态资源
app.use(express.static(path.join(__dirname, "public"), { maxAge: 86400 * 1000 }));
app.use(express.static(path.join(__dirname, "db")));
app.use("/assets", [
    express.static(__dirname + "/node_modules/jquery/dist/", { maxAge: 86400 * 1000 }),
    express.static(__dirname + "/node_modules/bootstrap/dist/", { maxAge: 86400 * 1000 }),
    express.static(__dirname + "/node_modules/axios/dist/", { maxAge: 86400 * 1000 }),
    express.static(__dirname + "/node_modules/leancloud-storage/dist", { maxAge: 86400 * 1000 }),
]);

// 加载路由
app.use("/", danmakuRouter);
app.use("/xml", express.static(path.join(__dirname, "public/xml")));

// 自动清理旧的 XML 文件
const XML_DIR = path.join(__dirname, "public/xml");
const EXPIRATION_TIME = 7 * 24 * 60 * 60 * 1000; // 7 天

function cleanOldXMLFiles() {
    console.log("[清理任务] 开始清理旧的 XML 文件...");
    const now = Date.now();

    fs.readdir(XML_DIR, (err, files) => {
        if (err) {
            console.error("[清理任务] 无法读取目录:", err);
            return;
        }

        files.forEach(file => {
            const filePath = path.join(XML_DIR, file);

            fs.stat(filePath, (err, stats) => {
                if (err) {
                    console.error("[清理任务] 无法获取文件信息:", err);
                    return;
                }

                // 检查文件是否过期
                if (now - stats.mtimeMs > EXPIRATION_TIME) {
                    fs.unlink(filePath, (err) => {
                        if (err) {
                            console.error("[清理任务] 删除文件失败:", err);
                        } else {
                            console.log("[清理任务] 已删除过期文件:", filePath);
                        }
                    });
                }
            });
        });
    });
}

// 定期清理任务（每天凌晨 3 点）
schedule.scheduleJob("0 3 * * *", cleanOldXMLFiles);

// 启动时清理一次
cleanOldXMLFiles();

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get("env") === "development" ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render("error");
});

module.exports = app;