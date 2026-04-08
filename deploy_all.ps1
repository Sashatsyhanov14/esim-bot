$bots = @("esim bot", "car bot", "tour bot", "infobot")
$desktop = "C:\Users\ТЕХНОРАЙ\Desktop"

foreach ($bot in $bots) {
    $path = Join-Path $desktop $bot
    if (Test-Path $path) {
        Write-Host "Syncing $bot..."
        Set-Location $path
        git add .
        $status = git status --porcelain
        if ($status) {
            git commit -m "PM2 naming and ports update"
            git push
            Write-Host "Done $bot"
        } else {
            Write-Host "No changes for $bot"
        }
    }
}
Write-Host "All bots processed."
