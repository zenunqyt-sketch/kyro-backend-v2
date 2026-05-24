@echo off
cd /d "%~dp0"
title Kyro Backend - Install
color 0B
echo.
echo  ================================
echo   Kyro Backend - Setup
echo  ================================
echo.
echo  Installing Node dependencies...
npm install
echo.
echo  Creating data folder...
if not exist "data" mkdir data
echo.
echo  Done! Run START.bat to launch the backend.
echo  Make sure MongoDB is installed from mongodb.com
echo.
pause
