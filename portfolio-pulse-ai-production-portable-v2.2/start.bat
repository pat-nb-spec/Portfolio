@echo off
cd /d %~dp0
if not exist data mkdir data
start "" http://localhost:8787
node server.mjs
pause
