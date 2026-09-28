@echo off
chcp 65001 > nul
echo ========================================================
echo   PUBLICADOR AUTOMATICO - PLAZA MEGATON A GITHUB
echo ========================================================
echo.
echo Este script crea el commit y envia Plaza Megaton a su
echo repositorio independiente en GitHub:
echo https://github.com/Luis28lh/plaza-megaton.git
echo.
echo Si aun no has creado el repositorio en GitHub:
echo 1. Abre https://github.com/new
echo 2. Nombre del repositorio: plaza-megaton
echo 3. Visibilidad: Public
echo 4. Haz clic en "Create repository"
echo.
pause
echo.
echo Inicializando y enviando...
git init
git checkout -b main
git config user.name "Luis Miguel Lizardo"
git config user.email "ing.lmlh@gmail.com"
git add .
git commit -m "feat: publicacion completa Sistema de Gestion Plaza Megaton v1.0"
git remote remove origin 2>nul
git remote add origin https://github.com/Luis28lh/plaza-megaton.git
git push -u origin main --force
echo.
echo ========================================================
echo ¡Operacion finalizada! Revisa tu repositorio en:
echo https://github.com/Luis28lh/plaza-megaton
echo ========================================================
pause
