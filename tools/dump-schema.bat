@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

rem ===========================================================================
rem  CozgutPos - baza gurlusyny cykarmak
rem
rem  Uc bazanyn (dukan, gozegcilik, girs) GURLUSYNY bir .sql fayla jemleyar.
rem  Cykan fayly baska kompyutere gecirip, restore-schema.bat bilen gurnayarsynyz.
rem
rem  Ulanylysy: su fayla iki gezek basyn (XAMPP MySQL isläp durmaly).
rem ===========================================================================

rem --- Sazlamalar -----------------------------------------------------------
set "MYSQL_BIN=C:\xampp\mysql\bin"
set "DB_LIST=dukan gozegcilik girs"
set "DB_USER=root"
rem Parol bar bolsa su setire yazyn, mysal: set "DB_PASS=1234"
set "DB_PASS="
set "DB_HOST=127.0.0.1"
set "DB_PORT=3306"

rem 1 = maglumatlar (dannylar) hem gossun, 0 = dinge gurlus (tablisalar bos)
set "WITH_DATA=0"

rem 1 = gurnalanda ozal bar bolan sol atly bazalary POZUP tazeden dorets
rem     DIKKAT: baska kompyuterde sol atly baza bar bolsa yitirilyar.
set "DROP_EXISTING=0"
rem --------------------------------------------------------------------------

set "OUT=%~dp0cozgut-schema.sql"

if not exist "%MYSQL_BIN%\mysqldump.exe" (
  echo [X] mysqldump.exe tapylmady: %MYSQL_BIN%
  echo     XAMPP baska yerde gurnalan bolsa, yokardaky MYSQL_BIN setirini duzedin.
  pause
  exit /b 1
)

if defined DB_PASS (set "PASS_ARG=--password=%DB_PASS%") else (set "PASS_ARG=")

set "DATA_ARG=--no-data"
if "%WITH_DATA%"=="1" set "DATA_ARG=--complete-insert --hex-blob"

set "DROP_ARG="
if "%DROP_EXISTING%"=="1" set "DROP_ARG=--add-drop-database"

echo.
echo  Bazalar : %DB_LIST%
if "%WITH_DATA%"=="1" (echo  Gornus  : gurlus + maglumatlar) else (echo  Gornus  : dinge gurlus)
echo  Fayl    : %OUT%
echo.

"%MYSQL_BIN%\mysqldump.exe" ^
  --host=%DB_HOST% --port=%DB_PORT% --user=%DB_USER% %PASS_ARG% ^
  --databases %DB_LIST% ^
  %DATA_ARG% %DROP_ARG% ^
  --routines --triggers --events ^
  --single-transaction ^
  --default-character-set=utf8mb4 ^
  --result-file="%OUT%"

if errorlevel 1 (
  echo.
  echo [X] Cykarmak basartmady. Kop dus gelyan sebapler:
  echo     - XAMPP Control Panel-da MySQL isläp durmandyr
  echo     - Parol nadogry ^(yokardaky DB_PASS^)
  echo     - Baza atlarynyn biri yalnys yazylan ^(%DB_LIST%^)
  echo.
  pause
  exit /b 1
)

echo.
echo [OK] Tayyar: %OUT%
echo      Su fayly baska kompyutere gecirin we restore-schema.bat bilen gurnan.
echo.
pause
endlocal
