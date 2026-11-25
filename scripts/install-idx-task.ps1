# Memasang tugas terjadwal Windows "ArahSaham IDX Sync": Senin-Jumat 16:15 dan 16:45 (waktu komputer, setel WIB).
# Bila komputer mati saat jadwal, tugas berjalan begitu komputer menyala (StartWhenAvailable).
# Pakai:   powershell -ExecutionPolicy Bypass -File scripts\install-idx-task.ps1
# Lepas:   Unregister-ScheduledTask -TaskName "ArahSaham IDX Sync" -Confirm:$false
$root = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node -ErrorAction Stop).Source
$action = New-ScheduledTaskAction -Execute $node -Argument "scripts\idx-sync.mjs" -WorkingDirectory $root
$days = "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"
$triggers = @((New-ScheduledTaskTrigger -Weekly -DaysOfWeek $days -At "16:15"), (New-ScheduledTaskTrigger -Weekly -DaysOfWeek $days -At "16:45"))
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 20)
Register-ScheduledTask -TaskName "ArahSaham IDX Sync" -Action $action -Trigger $triggers -Settings $settings -Description "Ambil data IDX (saham, indeks, broker) dan kirim ke Supabase." -Force | Out-Null
Get-ScheduledTask -TaskName "ArahSaham IDX Sync" | Select-Object TaskName, State
