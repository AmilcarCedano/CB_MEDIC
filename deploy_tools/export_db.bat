@echo off
set /p DB_USER="Ingresa el usuario de MySQL (por defecto root): "
if "%DB_USER%"=="" set DB_USER=root
set /p DB_NAME="Ingresa el nombre de la base de datos (por defecto cbmedic): "
if "%DB_NAME%"=="" set DB_NAME=cbmedic

echo Exportando base de datos a cbmedic_backup.sql...
mysqldump -u %DB_USER% -p %DB_NAME% > cbmedic_backup.sql

if %ERRORLEVEL% equ 0 (
    echo.
    echo Exportacion exitosa! Sube el archivo 'cbmedic_backup.sql' a tu VPS.
) else (
    echo.
    echo Hubo un error al exportar. Asegurate de tener MySQL instalado y en tu PATH.
)
pause
