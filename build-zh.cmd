@echo off
rem ---------------------------------------------------------------------------
rem Builds the zh-CN NSIS installer, logging everything to build-zh.log.
rem
rem Only "cargo check" can abort the run: a Rust error means the release build
rem cannot succeed either, and failing in the debug profile saves the long
rem codegen pass. Formatting, lint and tests are reported but never block the
rem installer. The build step itself is just "npm run tauri:build:zh".
rem Delete this file whenever you like.
rem ---------------------------------------------------------------------------
setlocal enabledelayedexpansion
cd /d "%~dp0"

rem tauri:dev and tauri:check prepend this; tauri:build does not.
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
set "LOG=%~dp0build-zh.log"
set "SOFTFAIL="

echo ChurchDisplay Pro zh-CN build> "%LOG%"
echo started %DATE% %TIME%>> "%LOG%"

rem ---- blocking: a Rust error stops everything -------------------------------
set "STAGE=cargo check"
echo [%TIME%] %STAGE%
echo.>> "%LOG%"
echo ===== %STAGE% =====>> "%LOG%"
cargo check --manifest-path src-tauri\Cargo.toml >> "%LOG%" 2>&1
if errorlevel 1 goto hardfail

rem ---- reported, but never block the installer -------------------------------
set "STAGE=cargo test"
echo [%TIME%] %STAGE%
echo.>> "%LOG%"
echo ===== %STAGE% =====>> "%LOG%"
cargo test --manifest-path src-tauri\Cargo.toml >> "%LOG%" 2>&1
if errorlevel 1 set "SOFTFAIL=!SOFTFAIL! cargo-test"

set "STAGE=cargo fmt --check"
echo [%TIME%] %STAGE%
echo.>> "%LOG%"
echo ===== %STAGE% =====>> "%LOG%"
cargo fmt --manifest-path src-tauri\Cargo.toml --check >> "%LOG%" 2>&1
if errorlevel 1 set "SOFTFAIL=!SOFTFAIL! cargo-fmt"

set "STAGE=npm test"
echo [%TIME%] %STAGE%
echo.>> "%LOG%"
echo ===== %STAGE% =====>> "%LOG%"
call npm test >> "%LOG%" 2>&1
if errorlevel 1 set "SOFTFAIL=!SOFTFAIL! npm-test"

set "STAGE=npm run lint"
echo [%TIME%] %STAGE%
echo.>> "%LOG%"
echo ===== %STAGE% =====>> "%LOG%"
call npm run lint >> "%LOG%" 2>&1
if errorlevel 1 set "SOFTFAIL=!SOFTFAIL! lint"

rem ---- the actual installer --------------------------------------------------
set "STAGE=npm run tauri:build:zh"
echo [%TIME%] %STAGE%  (this is the long one)
echo.>> "%LOG%"
echo ===== %STAGE% =====>> "%LOG%"
call npm run tauri:build:zh >> "%LOG%" 2>&1
if errorlevel 1 goto hardfail

echo.>> "%LOG%"
echo ===== BUILD OK =====>> "%LOG%"
if not "!SOFTFAIL!"=="" echo checks that reported problems:!SOFTFAIL!>> "%LOG%"
echo finished %DATE% %TIME%>> "%LOG%"
echo.>> "%LOG%"
dir "src-tauri\target\release\bundle\nsis\*.exe" >> "%LOG%" 2>&1
echo.
echo BUILD OK.  Installer: src-tauri\target\release\bundle\nsis
if not "!SOFTFAIL!"=="" echo NOTE: these checks reported problems:!SOFTFAIL!
echo Full log: build-zh.log
goto end

:hardfail
set "CODE=%errorlevel%"
echo.>> "%LOG%"
echo ===== FAILED at "%STAGE%" (exit %CODE%) =====>> "%LOG%"
if not "!SOFTFAIL!"=="" echo earlier checks also reported:!SOFTFAIL!>> "%LOG%"
echo finished %DATE% %TIME%>> "%LOG%"
echo.
echo FAILED at: %STAGE%   (exit %CODE%)
echo See build-zh.log for the full output.

:end
endlocal
echo.
pause
