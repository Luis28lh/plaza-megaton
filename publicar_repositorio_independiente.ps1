# Script PowerShell para publicar Plaza Megatón a su repositorio independiente en GitHub
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   PUBLICADOR AUTOMÁTICO — PLAZA MEGATÓN A GITHUB" -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Destino: https://github.com/Luis28lh/plaza-megaton.git" -ForegroundColor White
Write-Host ""
Write-Host "Si aún no has creado el repositorio en GitHub:" -ForegroundColor Gray
Write-Host "1. Abre en tu navegador: https://github.com/new" -ForegroundColor Gray
Write-Host "2. Nombre: plaza-megaton" -ForegroundColor Gray
Write-Host "3. Visibilidad: Public" -ForegroundColor Gray
Write-Host "4. Clic en 'Create repository'" -ForegroundColor Gray
Write-Host ""

$confirm = Read-Host "¿Deseas ejecutar la sincronización y git push ahora? (S/N)"
if ($confirm -match "^[sSyY]") {
    git init
    git checkout -B main
    git config user.name "Luis Miguel Lizardo"
    git config user.email "ing.lmlh@gmail.com"
    git add .
    git commit -m "feat: publicacion completa Sistema de Gestion Plaza Megaton v1.0"
    git remote remove origin 2>$null
    git remote add origin https://github.com/Luis28lh/plaza-megaton.git
    git push -u origin main --force
    Write-Host ""
    Write-Host "✅ ¡Publicación enviada a GitHub con éxito!" -ForegroundColor Green
    Write-Host "🔗 Repositorio: https://github.com/Luis28lh/plaza-megaton" -ForegroundColor Cyan
} else {
    Write-Host "Operación cancelada." -ForegroundColor Yellow
}
