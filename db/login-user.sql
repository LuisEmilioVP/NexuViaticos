-- ===================================================================================
-- SCRIPT PARA CREAR USUARIOS DEDICADOS DE BASE DE DATOS
-- Ejecutar como SA o administrador de SQL Server
-- ===================================================================================

USE master;
GO

-- Crear logins con contraseñas seguras
IF NOT EXISTS (SELECT name FROM sys.server_principals WHERE name = 'soft_db')
BEGIN
    CREATE LOGIN soft_db WITH PASSWORD = 'SoftDB2025!Admin',
                              CHECK_POLICY = ON,
                              CHECK_EXPIRATION = OFF,
                              DEFAULT_DATABASE = RendicionGastos;
    PRINT '✅ Login soft_db creado exitosamente';
END
ELSE
BEGIN
    PRINT '⚠️ Login soft_db ya existe';
END
GO

IF NOT EXISTS (SELECT name FROM sys.server_principals WHERE name = 'soft_ad')
BEGIN
    CREATE LOGIN soft_ad WITH PASSWORD = 'SoftAD2025!Admin',
                              CHECK_POLICY = ON,
                              CHECK_EXPIRATION = OFF,
                              DEFAULT_DATABASE = RendicionGastos;
    PRINT '✅ Login soft_ad creado exitosamente';
END
ELSE
BEGIN
    PRINT '⚠️ Login soft_ad ya existe';
END
GO

-- Asignar permisos de servidor
ALTER SERVER ROLE dbcreator ADD MEMBER soft_db;
ALTER SERVER ROLE dbcreator ADD MEMBER soft_ad;
PRINT '✅ Permisos de servidor asignados';
GO

-- Cambiar a la base de datos RendicionGastos
USE RendicionGastos;
GO

-- Crear usuarios en la base de datos
IF NOT EXISTS (SELECT name FROM sys.database_principals WHERE name = 'soft_db')
BEGIN
    CREATE USER soft_db FOR LOGIN soft_db;
    PRINT '✅ Usuario soft_db creado en BD';
END
GO

IF NOT EXISTS (SELECT name FROM sys.database_principals WHERE name = 'soft_ad')
BEGIN
    CREATE USER soft_ad FOR LOGIN soft_ad;
    PRINT '✅ Usuario soft_ad creado en BD';
END
GO

-- Asignar roles de base de datos (owner completo)
ALTER ROLE db_owner ADD MEMBER soft_db;
ALTER ROLE db_owner ADD MEMBER soft_ad;
PRINT '✅ Permisos db_owner asignados';
GO

-- Verificar creación
SELECT
    'soft_db' as Usuario,
    CASE WHEN sp.name IS NOT NULL THEN '✅ Existe' ELSE '❌ No existe' END as Login_Status,
    CASE WHEN dp.name IS NOT NULL THEN '✅ Existe' ELSE '❌ No existe' END as User_Status
FROM sys.server_principals sp
RIGHT JOIN (SELECT 'soft_db' as name) t ON sp.name = t.name AND sp.type = 'S'
LEFT JOIN sys.database_principals dp ON dp.name = 'soft_db'

UNION ALL

SELECT
    'soft_ad' as Usuario,
    CASE WHEN sp.name IS NOT NULL THEN '✅ Existe' ELSE '❌ No existe' END as Login_Status,
    CASE WHEN dp.name IS NOT NULL THEN '✅ Existe' ELSE '❌ No existe' END as User_Status
FROM sys.server_principals sp
RIGHT JOIN (SELECT 'soft_ad' as name) t ON sp.name = t.name AND sp.type = 'S'
LEFT JOIN sys.database_principals dp ON dp.name = 'soft_ad';

PRINT '';
PRINT '🔒 CREDENCIALES DE ACCESO:';
PRINT 'Usuario: soft_db | Password: SoftDB2024!Admin';
PRINT 'Usuario: soft_ad | Password: SoftAD2024!Admin';
PRINT '';
PRINT '📝 ACTUALIZAR EN .env:';
PRINT 'DB_USER=soft_db';
PRINT 'DB_PASSWORD=SoftDB2024!Admin';
