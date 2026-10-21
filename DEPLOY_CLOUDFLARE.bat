@echo off
chcp 65001 >nul
cd /d "%~dp0cloudflare"
where node >nul 2>&1
if errorlevel 1 goto node_missing
call npm ci
if errorlevel 1 goto fail
call npx wrangler login
if errorlevel 1 goto fail
call npx wrangler deploy
if errorlevel 1 goto fail
echo.
echo 管理キーを設定します。32文字以上のランダムな値を入力し、手元に保管してください。
call npx wrangler secret put ADMIN_KEY
if errorlevel 1 goto fail
echo.
echo Cloudflare Realtime TURNのKey IDを入力してください。
call npx wrangler secret put TURN_KEY_ID
if errorlevel 1 goto fail
echo.
echo Cloudflare Realtime TURNのAPI Tokenを入力してください。
call npx wrangler secret put TURN_KEY_API_TOKEN
if errorlevel 1 goto fail
echo.
echo 設定完了。deployで表示されたworkers.devのURLと管理キーを管理サイトへ入力してください。
pause
exit /b 0
:node_missing
echo Node.jsのLTS版をインストールしてから開き直してください。
pause
exit /b 1
:fail
echo 処理を停止しました。上のエラーを確認してください。
pause
exit /b 1
