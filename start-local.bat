@echo off
chcp 65001 >nul 2>&1
echo ========================================
echo   Legado Home 本地开发环境启动
echo ========================================
echo.

REM 检查MySQL是否可用
echo [1/3] 检查MySQL连接 ...
cd /d d:\legado-home\server
node -e "const m=require('mysql2/promise');m.createConnection({host:'127.0.0.1',port:3306,user:'root',password:'f1243657988'}).then(c=>c.execute('SELECT 1').then(()=>{console.log('MySQL OK');c.end();process.exit(0)})).catch(e=>{console.log('MySQL ERR:',e.message);process.exit(1)})" 2>nul
if %errorlevel% neq 0 (
    echo [错误] 无法连接到MySQL，请确认MySQL服务已启动
    pause
    exit /b 1
)

REM 启动后端
echo [2/3] 启动后端 (localhost:3001) ...
start /b cmd /c "set DB_HOST=127.0.0.1&& set DB_PORT=3306&& set DB_USER=root&& set DB_PASSWORD=f1243657988&& set DB_NAME=soumal&& set REDIS_ENABLED=false&& set PORT=3001&& set NODE_ENV=development&& set ADMIN_USERNAME=admin&& set ADMIN_PASSWORD=admin123&& set JWT_SECRET=legado-web-secret-key-change-in-production&& set CORS_ORIGIN=*&& set UPLOAD_DIR=data/uploads&& cd /d d:\legado-home\server&& npx tsx src/app.ts > d:\legado-home\server.log 2>&1"
timeout /t 10 /nobreak >nul

REM 启动前端
echo [3/3] 启动前端 (localhost:5341) ...
start /b cmd /c "cd /d D:\legado-home\web2&& npx vite --port 5341 > d:\legado-home\frontend.log 2>&1"
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo   启动完成！
echo   前端: http://localhost:5341/
echo   后端: http://localhost:3001/
echo   用户: admin / admin123
echo   数据库: Windows MySQL 8.0 (root)
echo ========================================
echo.
echo 按任意键关闭此窗口（服务将继续运行）...
pause >nul
