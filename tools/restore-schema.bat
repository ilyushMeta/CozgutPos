@echo off
chcp 65001 >nul
setlocal

rem ===========================================================================
rem  CozgutPos - baza gurlusyny gurnamak
rem
rem  dump-schema.bat bilen alnan cozgut-schema.sql fayly TAZE kompyuterde
rem  gurnayar. Fayl su .bat bilen bir papkada durmaly.
rem
rem  Fayl CREATE DATABASE setirlerini oz icinde saklayar, sonun ucin bazalary
rem  ondan owal el bilen dorezmek gerek dal.
rem ===========================================================================

set "MYSQL_BIN=C:\xampp\mysql\bin"
set "DB_USER=root"
rem Parol bar bolsa su setire yazyn, mysal: set "DB_PASS=1234"
set "DB_PASS="
set "DB_HOST=127.0.0.1"
set "DB_PORT=3306"

set "SQL=%~dp0cozgut-schema.sql"

if not exist "%SQL%" (
  echo [X] Fayl tapylmady: %SQL%
  pause
  exit /b 1
)

if not exist "%MYSQL_BIN%\mysql.exe" (
  echo [X] mysql.exe tapylmady: %MYSQL_BIN%
  pause
  exit /b 1
)

if defined DB_PASS (set "PASS_ARG=--password=%DB_PASS%") else (set "PASS_ARG=")

echo.
echo  Gurnalyar: %SQL%
echo.

"%MYSQL_BIN%\mysql.exe" ^
  --host=%DB_HOST% --port=%DB_PORT% --user=%DB_USER% %PASS_ARG% ^
  --default-character-set=utf8mb4 ^
  --execute="SOURCE %SQL%"

if errorlevel 1 (
  echo.
  echo [X] Gurnamak basartmady. MySQL isläp durmy? Parol dogrumy?
  pause
  exit /b 1
)

echo.
echo [OK] Bazalar gurnaldy. phpMyAdmin-de barlap gorun.
echo.
pause
endlocal
