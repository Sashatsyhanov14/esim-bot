# Скрипт для синхронизации всех ботов с GitHub
# Запустите этот скрипт в PowerShell, чтобы отправить изменения на сервер

$bots = @("esim bot", "car bot", "tour bot", "infobot")
$desktop = "C:\Users\ТЕХНОРАЙ\Desktop"

foreach ($bot in $bots) {
    $path = Join-Path $desktop $bot
    if (Test-Path $path) {
        Write-Host "`n🚀 Синхронизация $bot..." -ForegroundColor Cyan
        Set-Location $path
        
        # Добавляем изменения
        git add .
        
        # Пытаемся закоммитить (если есть изменения)
        $status = git status --porcelain
        if ($status) {
            git commit -m "System update: referral fix, USD migration and dashboard updates"
            git push
            Write-Host "✅ Изменения отправлены!" -ForegroundColor Green
        } else {
            Write-Host "ℹ️ Изменений нет, пропускаю." -ForegroundColor Gray
        }
    } else {
        Write-Host "⚠️ Папка $bot не найдена по пути $path" -ForegroundColor Yellow
    }
}

Write-Host "`n✨ Все локальные изменения отправлены в GitHub!" -ForegroundColor Green
Write-Host "--------------------------------------------------" -ForegroundColor White
Write-Host "👉 Теперь зайдите в терминал VPS и выполните:" -ForegroundColor Yellow
Write-Host "cd /root/bots/bot4/ && bash update_all_bots.sh" -ForegroundColor White
Write-Host "--------------------------------------------------" -ForegroundColor White
