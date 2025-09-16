-- ===================================================================================
-- BASE DE DATOS: SISTEMA DE RENDICION DE GASTOS
-- Motor: SQL Server
-- ===================================================================================

USE master;
GO

-- Crear la base de datos si no existe
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'RendicionGastos')
BEGIN
    CREATE DATABASE RendicionGastos;
END
GO

USE RendicionGastos;
GO

-- ===================================================================================
-- TABLAS DEL SISTEMA
-- ===================================================================================

-- Tabla de Usuarios
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Usuarios' AND xtype='U')
BEGIN
    CREATE TABLE Usuarios (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        NombreCompleto NVARCHAR(100) NOT NULL,
        Username NVARCHAR(50) NOT NULL UNIQUE,
        Password NVARCHAR(255) NOT NULL,
        Role NVARCHAR(20) NOT NULL CHECK (Role IN ('admin', 'user')),
        FechaCreacion DATETIME2 DEFAULT GETDATE(),
        Activo BIT DEFAULT 1
    );
END
GO

-- Tabla de Clientes
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Clientes' AND xtype='U')
BEGIN
    CREATE TABLE Clientes (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Nombre NVARCHAR(200) NOT NULL,
        FechaCreacion DATETIME2 DEFAULT GETDATE(),
        Activo BIT DEFAULT 1
    );
END
GO

-- Tabla de Sucursales
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Sucursales' AND xtype='U')
BEGIN
    CREATE TABLE Sucursales (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ClienteId INT NOT NULL,
        Nombre NVARCHAR(200) NOT NULL,
        Ubicacion NVARCHAR(200),
        FechaCreacion DATETIME2 DEFAULT GETDATE(),
        Activo BIT DEFAULT 1,
        FOREIGN KEY (ClienteId) REFERENCES Clientes(Id)
    );
END
GO

-- Tabla de Tipos de Gastos
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='TiposGastos' AND xtype='U')
BEGIN
    CREATE TABLE TiposGastos (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Nombre NVARCHAR(100) NOT NULL,
        Cuenta NVARCHAR(50) NOT NULL,
        FechaCreacion DATETIME2 DEFAULT GETDATE(),
        Activo BIT DEFAULT 1
    );
END
GO

-- Tabla de Rendiciones (Reportes)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Rendiciones' AND xtype='U')
BEGIN
    CREATE TABLE Rendiciones (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        CodigoRendicion AS ('R' + RIGHT('000000' + CAST(Id AS VARCHAR(6)), 6)),
        UsuarioId INT NOT NULL,
        FechaCreacion DATETIME2 DEFAULT GETDATE(),
        Total DECIMAL(18,2) NOT NULL DEFAULT 0,
        Estado NVARCHAR(50) NOT NULL DEFAULT 'Implementación' CHECK (Estado IN ('Implementación', 'Salida a Producción', 'Reparación', 'Entrega de equipo', 'Otro')),
        EstadoPersonalizado NVARCHAR(100) NULL,
        Observaciones NVARCHAR(500) NULL,
        FOREIGN KEY (UsuarioId) REFERENCES Usuarios(Id)
    );
END
GO

-- Tabla de Gastos
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Gastos' AND xtype='U')
BEGIN
    CREATE TABLE Gastos (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        RendicionId INT NOT NULL,
        TipoGastoId INT NOT NULL,
        ClienteId INT NOT NULL,
        SucursalId INT NULL,
        Fecha DATE NOT NULL,
        Descripcion NVARCHAR(500) NOT NULL,
        ImporteSinItbis DECIMAL(18,2) NOT NULL,
        Itbis DECIMAL(18,2) NOT NULL DEFAULT 0,
        Total AS (ImporteSinItbis + Itbis) PERSISTED,
        FechaCreacion DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (RendicionId) REFERENCES Rendiciones(Id) ON DELETE CASCADE,
        FOREIGN KEY (TipoGastoId) REFERENCES TiposGastos(Id),
        FOREIGN KEY (ClienteId) REFERENCES Clientes(Id),
        FOREIGN KEY (SucursalId) REFERENCES Sucursales(Id)
    );
END
GO


-- Tabla de Viáticos
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Viaticos' AND xtype='U')
BEGIN
    CREATE TABLE Viaticos (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      UsuarioId INT NOT NULL,
      MontoAsignado DECIMAL(18,2) NOT NULL,
      FechaAsignacion DATE NOT NULL,
      FechaVencimiento DATE NOT NULL,
      Descripcion NVARCHAR(200),
      Estado NVARCHAR(20) DEFAULT 'Activo' CHECK (Estado IN ('Activo', 'Vencido', 'Liquidado')),
      FechaCreacion DATETIME2 DEFAULT GETDATE(),
      FOREIGN KEY (UsuarioId) REFERENCES Usuarios(Id)
    );
END
GO

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='MovimientosViaticos' AND xtype='U')
BEGIN
    CREATE TABLE MovimientosViaticos (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ViaticoId INT NOT NULL,
      RendicionId INT NULL,
      TipoMovimiento NVARCHAR(20) NOT NULL CHECK (TipoMovimiento IN ('Asignacion', 'Gasto', 'Reintegro')),
      Monto DECIMAL(18,2) NOT NULL,
      Descripcion NVARCHAR(200),
      Fecha DATETIME2 DEFAULT GETDATE(),
      FOREIGN KEY (ViaticoId) REFERENCES Viaticos(Id),
      FOREIGN KEY (RendicionId) REFERENCES Rendiciones(Id)
    );
END
GO

-- ===================================================================================
-- INSERTAR DATOS INICIALES
-- ===================================================================================

-- Usuarios iniciales
IF NOT EXISTS (SELECT * FROM Usuarios)
BEGIN
    INSERT INTO Usuarios (NombreCompleto, Username, Password, Role) VALUES
    ('Super Usuario', 'admin', 'admin123', 'admin'),
    ('Demo User', 'demo', 'demo123', 'user');
END
GO

-- Tipos de Gastos iniciales
IF NOT EXISTS (SELECT * FROM TiposGastos)
BEGIN
    INSERT INTO TiposGastos (Nombre, Cuenta) VALUES
    ('MOVILIDAD / VIATICOS', '510101021'),
    ('ALIMENTOS / REFRIGERIOS', '510101023'),
    ('ALOJAMIENTO', '510101022'),
    ('PAPELERIA / LIBRERIA', '520301'),
    ('GASTOS DE HARDWARE', '520321'),
    ('OTROS', '999999999');
END
GO

-- Clientes iniciales
IF NOT EXISTS (SELECT * FROM Clientes)
BEGIN
    INSERT INTO Clientes (Nombre) VALUES
    ('Cliente Alfa S.R.L.'),
    ('Compañía Beta S.A.'),
    ('Servicios Gamma');
END
GO

-- Sucursales iniciales
IF NOT EXISTS (SELECT * FROM Sucursales)
BEGIN
    INSERT INTO Sucursales (ClienteId, Nombre, Ubicacion) VALUES
    (1, 'Sucursal Principal (Alfa)', 'Santo Domingo'),
    (1, 'Sucursal Santiago (Alfa)', 'Santiago'),
    (2, 'Oficina Central (Beta)', 'Punta Cana');
END
GO

-- ===================================================================================
-- VISTAS Y PROCEDIMIENTOS ALMACENADOS
-- ===================================================================================

-- Vista para Rendiciones con información detallada
GO
CREATE OR ALTER VIEW vw_RendicionesDetalle AS
SELECT
    r.Id,
    r.CodigoRendicion,
    r.UsuarioId,
    u.NombreCompleto AS NombreEmpleado,
    u.Username,
    r.FechaCreacion,
    r.Total,
    r.Estado,
    r.EstadoPersonalizado,
    r.Observaciones,
    COUNT(g.Id) AS TotalGastos
FROM Rendiciones r
INNER JOIN Usuarios u ON r.UsuarioId = u.Id
LEFT JOIN Gastos g ON r.Id = g.RendicionId
GROUP BY r.Id, r.CodigoRendicion, r.UsuarioId, u.NombreCompleto, u.Username,
         r.FechaCreacion, r.Total, r.Estado, r.EstadoPersonalizado, r.Observaciones;
GO

-- ===================================================================================
-- PROCEDIMIENTOS ALMACENADOS
-- ===================================================================================

-- Procedimiento para obtener rendiciones por usuario
-- CREATE OR ALTER PROCEDURE sp_ObtenerRendicionesPorUsuario
--     @UsuarioId INT = NULL,
--     @EsAdmin BIT = 0
-- AS
-- BEGIN
--     SET NOCOUNT ON;

--     IF @EsAdmin = 1
--     BEGIN
--         -- Admin ve todas las rendiciones
--         SELECT * FROM vw_RendicionesDetalle
--         ORDER BY FechaCreacion DESC;
--     END
--     ELSE
--     BEGIN
--         -- Usuario normal solo ve sus rendiciones
--         SELECT * FROM vw_RendicionesDetalle
--         WHERE UsuarioId = @UsuarioId
--         ORDER BY FechaCreacion DESC;
--     END
-- END
-- GO

- Obtener rendiciones por usuario
CREATE PROCEDURE sp_ObtenerRendicionesPorUsuario
    @UsuarioId INT = NULL,
    @EsAdmin BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        r.Id,
        ('R' + RIGHT('000000' + CAST(r.Id AS VARCHAR(6)), 6)) as CodigoRendicion,
        r.UsuarioId,
        u.NombreCompleto AS NombreEmpleado,
        u.Username,
        r.FechaCreacion,
        r.Total,
        r.Estado,
        r.EstadoPersonalizado,
        r.Observaciones,
        COUNT(g.Id) AS TotalGastos
    FROM Rendiciones r
    INNER JOIN Usuarios u ON r.UsuarioId = u.Id
    LEFT JOIN Gastos g ON r.Id = g.RendicionId
    WHERE (@EsAdmin = 1 OR r.UsuarioId = @UsuarioId)
    GROUP BY r.Id, r.UsuarioId, u.NombreCompleto, u.Username,
             r.FechaCreacion, r.Total, r.Estado, r.EstadoPersonalizado, r.Observaciones
    ORDER BY r.FechaCreacion DESC;
END
GO

-- Procedimiento para obtener detalles de una rendición
-- CREATE OR ALTER PROCEDURE sp_ObtenerDetalleRendicion
--     @RendicionId INT
-- AS
-- BEGIN
--     SET NOCOUNT ON;

--     -- Información de la rendición
--     SELECT r.*, u.NombreCompleto AS NombreEmpleado, u.Username
--     FROM Rendiciones r
--     INNER JOIN Usuarios u ON r.UsuarioId = u.Id
--     WHERE r.Id = @RendicionId;

--     -- Gastos de la rendición
--     SELECT g.*,
--            tg.Nombre AS TipoGasto,
--            tg.Cuenta,
--            c.Nombre AS Cliente,
--            s.Nombre AS Sucursal,
--            s.Ubicacion
--     FROM Gastos g
--     INNER JOIN TiposGastos tg ON g.TipoGastoId = tg.Id
--     INNER JOIN Clientes c ON g.ClienteId = c.Id
--     LEFT JOIN Sucursales s ON g.SucursalId = s.Id
--     WHERE g.RendicionId = @RendicionId
--     ORDER BY g.Fecha DESC;
-- END
-- GO

-- Obtener detalles de rendición
CREATE PROCEDURE sp_ObtenerDetalleRendicion
    @RendicionId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Información de la rendición
    SELECT r.*,
           ('R' + RIGHT('000000' + CAST(r.Id AS VARCHAR(6)), 6)) as CodigoRendicion,
           u.NombreCompleto AS NombreEmpleado,
           u.Username
    FROM Rendiciones r
    INNER JOIN Usuarios u ON r.UsuarioId = u.Id
    WHERE r.Id = @RendicionId;

    -- Gastos de la rendición
    SELECT g.*,
           tg.Nombre AS TipoGasto,
           tg.Cuenta,
           c.Nombre AS Cliente,
           s.Nombre AS Sucursal,
           s.Ubicacion
    FROM Gastos g
    INNER JOIN TiposGastos tg ON g.TipoGastoId = tg.Id
    INNER JOIN Clientes c ON g.ClienteId = c.Id
    LEFT JOIN Sucursales s ON g.SucursalId = s.Id
    WHERE g.RendicionId = @RendicionId
    ORDER BY g.Fecha DESC;
END
GO

-- Obtener balance de viáticos
CREATE PROCEDURE sp_ObtenerBalanceViaticos
    @UsuarioId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        v.Id,
        v.MontoAsignado,
        v.FechaAsignacion,
        v.FechaVencimiento,
        v.Descripcion,
        v.Estado,
        ISNULL(SUM(CASE WHEN mv.TipoMovimiento = 'Gasto' THEN mv.Monto ELSE 0 END), 0) as MontoGastado,
        ISNULL(SUM(CASE WHEN mv.TipoMovimiento = 'Reintegro' THEN mv.Monto ELSE 0 END), 0) as MontoReintegrado,
        v.MontoAsignado - ISNULL(SUM(CASE WHEN mv.TipoMovimiento = 'Gasto' THEN mv.Monto ELSE 0 END), 0) +
        ISNULL(SUM(CASE WHEN mv.TipoMovimiento = 'Reintegro' THEN mv.Monto ELSE 0 END), 0) as SaldoDisponible,
        DATEDIFF(day, GETDATE(), v.FechaVencimiento) as DiasRestantes,
        CASE
            WHEN DATEDIFF(day, GETDATE(), v.FechaVencimiento) < 0 THEN 'VENCIDO'
            WHEN DATEDIFF(day, GETDATE(), v.FechaVencimiento) <= 5 THEN 'CRITICO'
            WHEN DATEDIFF(day, GETDATE(), v.FechaVencimiento) <= 15 THEN 'ALERTA'
            ELSE 'NORMAL'
        END as AlertaVencimiento
    FROM Viaticos v
    LEFT JOIN MovimientosViaticos mv ON v.Id = mv.ViaticoId
    WHERE v.UsuarioId = @UsuarioId AND v.Estado = 'Activo'
    GROUP BY v.Id, v.MontoAsignado, v.FechaAsignacion, v.FechaVencimiento, v.Descripcion, v.Estado
    ORDER BY v.FechaVencimiento ASC;
END
GO

-- Registrar movimiento de viático
CREATE PROCEDURE sp_RegistrarMovimientoViatico
    @ViaticoId INT,
    @RendicionId INT = NULL,
    @TipoMovimiento NVARCHAR(20),
    @Monto DECIMAL(18,2),
    @Descripcion NVARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO MovimientosViaticos (ViaticoId, RendicionId, TipoMovimiento, Monto, Descripcion)
    VALUES (@ViaticoId, @RendicionId, @TipoMovimiento, @Monto, @Descripcion);

    -- Actualizar estado del viático
    UPDATE Viaticos
    SET Estado = CASE
        WHEN FechaVencimiento < GETDATE() THEN 'Vencido'
        ELSE 'Activo'
    END
    WHERE Id = @ViaticoId;
END
GO

-- Actualizar total de rendición
CREATE PROCEDURE sp_ActualizarTotalRendicion
    @RendicionId INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE Rendiciones
    SET Total = (
        SELECT ISNULL(SUM(ImporteSinItbis + Itbis), 0)
        FROM Gastos
        WHERE RendicionId = @RendicionId
    )
    WHERE Id = @RendicionId;
END
GO

-- Procedimiento para actualizar total de rendición
CREATE OR ALTER PROCEDURE sp_ActualizarTotalRendicion
    @RendicionId INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE Rendiciones
    SET Total = (
        SELECT ISNULL(SUM(ImporteSinItbis + Itbis), 0)
        FROM Gastos
        WHERE RendicionId = @RendicionId
    )
    WHERE Id = @RendicionId;
END
GO
-- ===================================================================================
-- TRIGGERS
-- ===================================================================================

-- Trigger para actualizar total de rendición al insertar/actualizar/eliminar gastos
-- GO
-- CREATE OR ALTER TRIGGER tr_ActualizarTotalRendicion
-- ON Gastos
-- AFTER INSERT, UPDATE, DELETE
-- AS
-- BEGIN
--     SET NOCOUNT ON;

--     -- Actualizar totales para rendiciones afectadas en INSERT/UPDATE
--     IF EXISTS(SELECT * FROM inserted)
--     BEGIN
--         DECLARE @RendicionId_Insert INT;
--         DECLARE insert_cursor CURSOR FOR
--         SELECT DISTINCT RendicionId FROM inserted;

--         OPEN insert_cursor;
--         FETCH NEXT FROM insert_cursor INTO @RendicionId_Insert;

--         WHILE @@FETCH_STATUS = 0
--         BEGIN
--             EXEC sp_ActualizarTotalRendicion @RendicionId = @RendicionId_Insert;
--             FETCH NEXT FROM insert_cursor INTO @RendicionId_Insert;
--         END

--         CLOSE insert_cursor;
--         DEALLOCATE insert_cursor;
--     END

--     -- Actualizar totales para rendiciones afectadas en DELETE
--     IF EXISTS(SELECT * FROM deleted)
--     BEGIN
--         DECLARE @RendicionId_Delete INT;
--         DECLARE delete_cursor CURSOR FOR
--         SELECT DISTINCT RendicionId FROM deleted;

--         OPEN delete_cursor;
--         FETCH NEXT FROM delete_cursor INTO @RendicionId_Delete;

--         WHILE @@FETCH_STATUS = 0
--         BEGIN
--             EXEC sp_ActualizarTotalRendicion @RendicionId = @RendicionId_Delete;
--             FETCH NEXT FROM delete_cursor INTO @RendicionId_Delete;
--         END

--         CLOSE delete_cursor;
--         DEALLOCATE delete_cursor;
--     END
-- END
-- GO

CREATE TRIGGER tr_ActualizarTotalRendicion
ON Gastos
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    -- Actualizar totales para rendiciones en INSERT/UPDATE
    IF EXISTS(SELECT * FROM inserted)
    BEGIN
        DECLARE @RendicionId_Insert INT;
        DECLARE insert_cursor CURSOR FOR
        SELECT DISTINCT RendicionId FROM inserted;

        OPEN insert_cursor;
        FETCH NEXT FROM insert_cursor INTO @RendicionId_Insert;

        WHILE @@FETCH_STATUS = 0
        BEGIN
            EXEC sp_ActualizarTotalRendicion @RendicionId = @RendicionId_Insert;
            FETCH NEXT FROM insert_cursor INTO @RendicionId_Insert;
        END

        CLOSE insert_cursor;
        DEALLOCATE insert_cursor;
    END

    -- Actualizar totales para rendiciones en DELETE
    IF EXISTS(SELECT * FROM deleted)
    BEGIN
        DECLARE @RendicionId_Delete INT;
        DECLARE delete_cursor CURSOR FOR
        SELECT DISTINCT RendicionId FROM deleted;

        OPEN delete_cursor;
        FETCH NEXT FROM delete_cursor INTO @RendicionId_Delete;

        WHILE @@FETCH_STATUS = 0
        BEGIN
            EXEC sp_ActualizarTotalRendicion @RendicionId = @RendicionId_Delete;
            FETCH NEXT FROM delete_cursor INTO @RendicionId_Delete;
        END

        CLOSE delete_cursor;
        DEALLOCATE delete_cursor;
    END
END
GO

-- ===================================================================================
-- ÍNDICES PARA RENDIMIENTO
-- ===================================================================================

-- Índices en tabla Usuarios
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Usuarios_Username')
    CREATE NONCLUSTERED INDEX IX_Usuarios_Username ON Usuarios(Username);

-- Índices en tabla Rendiciones
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Rendiciones_UsuarioId')
    CREATE NONCLUSTERED INDEX IX_Rendiciones_UsuarioId ON Rendiciones(UsuarioId);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Rendiciones_FechaCreacion')
    CREATE NONCLUSTERED INDEX IX_Rendiciones_FechaCreacion ON Rendiciones(FechaCreacion DESC);

-- Índices en tabla Gastos
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Gastos_RendicionId')
    CREATE NONCLUSTERED INDEX IX_Gastos_RendicionId ON Gastos(RendicionId);

-- Índices en tabla Sucursales
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Sucursales_ClienteId')
    CREATE NONCLUSTERED INDEX IX_Sucursales_ClienteId ON Sucursales(ClienteId);

-- Índices en tabla Sucursales
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Viaticos_UsuarioId')
    CREATE NONCLUSTERED INDEX IX_Viaticos_UsuarioId ON Viaticos(UsuarioId);

PRINT '✅ Base de datos creada exitosamente con todas las tablas y procedimientos';
GO
