@echo off
rem Start localcontacts and open it in its own window (Windows).
rem For a Start Menu icon, use Edge or Chrome's "Install app" once the page is open.
setlocal
cd /d "%~dp0..\.."
where node >nul 2>nul || (echo Node.js 22.13 or newer is required: https://nodejs.org & exit /b 1)
if not exist node_modules call npm install --no-audit --no-fund
if not exist .next\BUILD_ID call npm run build
if "%PORT%"=="" set PORT=3000
set NEXT_TELEMETRY_DISABLED=1
set URL=http://localhost:%PORT%
start "localcontacts server" /min node node_modules\next\dist\bin\next start -H 127.0.0.1 -p %PORT%
timeout /t 4 /nobreak >nul
set PROFILE=%LocalAppData%\localcontacts\browser-profile
for %%B in ("%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%LocalAppData%\Google\Chrome\Application\chrome.exe" "%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe") do (
  if exist %%B (
    start "" %%B --app=%URL% --user-data-dir="%PROFILE%" --no-first-run --no-default-browser-check
    goto :opened
  )
)
start "" %URL%
:opened
echo localcontacts is running at %URL%. Close the "localcontacts server" window to stop it.
endlocal
