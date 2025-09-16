require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const sql = require('mssql');
const path = require('path');
const ExcelJS = require('exceljs');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY;

// Configuración de la base de datos
const dbConfig = {
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	server: process.env.DB_SERVER,
	database: process.env.DB_DATABASE,
	options: {
		encrypt: process.env.DB_ENCRYPT === 'true',
		trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
		enableArithAbort: true,
	},
	pool: {
		max: 10,
		min: 0,
		idleTimeoutMillis: 30000,
	},
};

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

let poolPromise;

// Inicializar conexión BD
const initializeDatabase = async () => {
	try {
		poolPromise = new sql.ConnectionPool(dbConfig)
			.connect()
			.then((pool) => {
				console.log('✅ Conectado a SQL Server');
				return pool;
			})
			.catch((err) => {
				console.error('❌ Error de conexión:', err);
				process.exit(1);
			});
	} catch (error) {
		console.error('❌ Error al inicializar BD:', error);
		process.exit(1);
	}
};

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
	const authHeader = req.headers['authorization'];
	const token = authHeader && authHeader.split(' ')[1];

	if (!token) {
		return res.status(401).json({ error: 'Token requerido' });
	}

	jwt.verify(token, SECRET_KEY, (err, user) => {
		if (err) {
			return res.status(403).json({ error: 'Token inválido' });
		}
		req.user = user;
		next();
	});
};

const isAdmin = (req, res, next) => {
	if (req.user.role !== 'admin') {
		return res.status(403).json({ error: 'Acceso denegado' });
	}
	next();
};

// ===================================================================================
// ENDPOINTS DE AUTENTICACIÓN
// ===================================================================================

app.post('/api/login', async (req, res) => {
	try {
		const { username, password } = req.body;
		const pool = await poolPromise;

		const result = await pool
			.request()
			.input('username', sql.NVarChar, username)
			.input('password', sql.NVarChar, password).query(`
                SELECT Id, NombreCompleto, Username, Role
                FROM Usuarios
                WHERE Username = @username AND Password = @password AND Activo = 1
            `);

		if (result.recordset.length === 0) {
			return res.status(401).json({ error: 'Credenciales incorrectas' });
		}

		const user = result.recordset[0];
		const accessToken = jwt.sign(
			{ id: user.Id, username: user.Username, role: user.Role },
			SECRET_KEY,
			{ expiresIn: '8h' }
		);

		res.json({
			accessToken,
			user: {
				id: user.Id,
				nombreCompleto: user.NombreCompleto,
				username: user.Username,
				role: user.Role,
			},
		});
	} catch (error) {
		console.error('Error en login:', error);
		res.status(500).json({ error: 'Error interno' });
	}
});

// ===================================================================================
// ENDPOINTS DE DATOS
// ===================================================================================

app.get('/api/initial-data', authenticateToken, async (req, res) => {
	try {
		const pool = await poolPromise;

		const [usuarios, clientes, sucursales, tiposGastos] = await Promise.all([
			pool
				.request()
				.query(
					'SELECT Id, NombreCompleto, Username, Role FROM Usuarios WHERE Activo = 1'
				),
			pool.request().query('SELECT Id, Nombre FROM Clientes WHERE Activo = 1'),
			pool
				.request()
				.query(
					'SELECT Id, ClienteId, Nombre, Ubicacion FROM Sucursales WHERE Activo = 1'
				),
			pool
				.request()
				.query('SELECT Id, Nombre, Cuenta FROM TiposGastos WHERE Activo = 1'),
		]);

		res.json({
			users: usuarios.recordset,
			clients: clientes.recordset,
			branches: sucursales.recordset,
			expenseTypes: tiposGastos.recordset,
		});
	} catch (error) {
		console.error('Error datos iniciales:', error);
		res.status(500).json({ error: 'Error al obtener datos' });
	}
});

// ===================================================================================
// ENDPOINTS DE RENDICIONES
// ===================================================================================

app.get('/api/rendiciones', authenticateToken, async (req, res) => {
	try {
		const pool = await poolPromise;

		const result = await pool
			.request()
			.input('usuarioId', sql.Int, req.user.id)
			.input('esAdmin', sql.Bit, req.user.role === 'admin' ? 1 : 0)
			.execute('sp_ObtenerRendicionesPorUsuario');

		res.json(result.recordset);
	} catch (error) {
		console.error('Error obteniendo rendiciones:', error);
		res.status(500).json({ error: 'Error al obtener rendiciones' });
	}
});

app.post('/api/rendiciones', authenticateToken, async (req, res) => {
	const transaction = new sql.Transaction(await poolPromise);

	try {
		await transaction.begin();

		const {
			empleadoId,
			gastos,
			estado,
			estadoPersonalizado,
			observaciones,
			viaticoId,
		} = req.body;
		const targetUserId = req.user.role === 'admin' ? empleadoId : req.user.id;

		// Crear rendición
		const rendicionResult = await transaction
			.request()
			.input('usuarioId', sql.Int, targetUserId)
			.input('estado', sql.NVarChar, estado || 'Implementación')
			.input('estadoPersonalizado', sql.NVarChar, estadoPersonalizado)
			.input('observaciones', sql.NVarChar, observaciones).query(`
                INSERT INTO Rendiciones (UsuarioId, Estado, EstadoPersonalizado, Observaciones, Total)
                OUTPUT INSERTED.Id
                VALUES (@usuarioId, @estado, @estadoPersonalizado, @observaciones, 0)
            `);

		const rendicionId = rendicionResult.recordset[0].Id;
		const codigoRendicion = 'R' + ('000000' + rendicionId).slice(-6);

		// Insertar gastos
		for (const gasto of gastos) {
			await transaction
				.request()
				.input('rendicionId', sql.Int, rendicionId)
				.input('tipoGastoId', sql.Int, gasto.expenseTypeId)
				.input('clienteId', sql.Int, gasto.clientId)
				.input('sucursalId', sql.Int, gasto.branchId || null)
				.input('fecha', sql.Date, gasto.fecha)
				.input('descripcion', sql.NVarChar, gasto.descripcion)
				.input('importeSinItbis', sql.Decimal(18, 2), gasto.importe)
				.input('itbis', sql.Decimal(18, 2), gasto.itbis || 0).query(`
                    INSERT INTO Gastos (RendicionId, TipoGastoId, ClienteId, SucursalId, Fecha, Descripcion, ImporteSinItbis, Itbis)
                    VALUES (@rendicionId, @tipoGastoId, @clienteId, @sucursalId, @fecha, @descripcion, @importeSinItbis, @itbis)
                `);
		}

		// Registrar movimiento en viático
		if (viaticoId) {
			const totalRendicion = gastos.reduce(
				(sum, g) => sum + g.importe + (g.itbis || 0),
				0
			);
			await transaction
				.request()
				.input('viaticoId', sql.Int, viaticoId)
				.input('rendicionId', sql.Int, rendicionId)
				.input('tipoMovimiento', sql.NVarChar, 'Gasto')
				.input('monto', sql.Decimal(18, 2), totalRendicion)
				.input('descripcion', sql.NVarChar, `Rendición ${codigoRendicion}`)
				.execute('sp_RegistrarMovimientoViatico');
		}

		await transaction.commit();

		res.status(201).json({
			id: rendicionId,
			codigoRendicion: codigoRendicion,
			message: 'Rendición creada exitosamente',
		});
	} catch (error) {
		await transaction.rollback();
		console.error('Error creando rendición:', error);
		res.status(500).json({ error: 'Error al crear rendición' });
	}
});

app.get('/api/rendiciones/:id', authenticateToken, async (req, res) => {
	try {
		const pool = await poolPromise;
		const rendicionId = parseInt(req.params.id);

		const result = await pool
			.request()
			.input('rendicionId', sql.Int, rendicionId)
			.execute('sp_ObtenerDetalleRendicion');

		if (result.recordsets[0].length === 0) {
			return res.status(404).json({ error: 'Rendición no encontrada' });
		}

		const rendicion = result.recordsets[0][0];
		const gastos = result.recordsets[1];

		// Verificar permisos
		if (req.user.role !== 'admin' && rendicion.UsuarioId !== req.user.id) {
			return res.status(403).json({ error: 'Sin permisos' });
		}

		res.json({ rendicion, gastos });
	} catch (error) {
		console.error('Error detalle rendición:', error);
		res.status(500).json({ error: 'Error al obtener detalle' });
	}
});

// ===================================================================================
// ENDPOINTS DE VIÁTICOS
// ===================================================================================

app.get('/api/viaticos/balance', authenticateToken, async (req, res) => {
	try {
		const pool = await poolPromise;

		const result = await pool
			.request()
			.input('usuarioId', sql.Int, req.user.id)
			.execute('sp_ObtenerBalanceViaticos');

		res.json(result.recordset);
	} catch (error) {
		console.error('Error balance viáticos:', error);
		res.status(500).json({ error: 'Error al obtener balance' });
	}
});

app.post('/api/viaticos', [authenticateToken, isAdmin], async (req, res) => {
	try {
		const {
			usuarioId,
			montoAsignado,
			fechaAsignacion,
			fechaVencimiento,
			descripcion,
		} = req.body;
		const pool = await poolPromise;

		const result = await pool
			.request()
			.input('usuarioId', sql.Int, usuarioId)
			.input('montoAsignado', sql.Decimal(18, 2), montoAsignado)
			.input('fechaAsignacion', sql.Date, fechaAsignacion)
			.input('fechaVencimiento', sql.Date, fechaVencimiento)
			.input('descripcion', sql.NVarChar, descripcion).query(`
                INSERT INTO Viaticos (UsuarioId, MontoAsignado, FechaAsignacion, FechaVencimiento, Descripcion)
                OUTPUT INSERTED.Id
                VALUES (@usuarioId, @montoAsignado, @fechaAsignacion, @fechaVencimiento, @descripcion)
            `);

		const viaticoId = result.recordset[0].Id;

		// Registrar asignación
		await pool
			.request()
			.input('viaticoId', sql.Int, viaticoId)
			.input('tipoMovimiento', sql.NVarChar, 'Asignacion')
			.input('monto', sql.Decimal(18, 2), montoAsignado)
			.input('descripcion', sql.NVarChar, descripcion || 'Asignación inicial')
			.execute('sp_RegistrarMovimientoViatico');

		res.status(201).json({ id: viaticoId, message: 'Viático creado' });
	} catch (error) {
		console.error('Error creando viático:', error);
		res.status(500).json({ error: 'Error al crear viático' });
	}
});

app.get('/api/viaticos/:id/movimientos', authenticateToken, async (req, res) => {
	try {
		const pool = await poolPromise;
		const viaticoId = parseInt(req.params.id);

		const result = await pool.request().input('viaticoId', sql.Int, viaticoId)
			.query(`
                SELECT mv.*, ('R' + RIGHT('000000' + CAST(r.Id AS VARCHAR(6)), 6)) as CodigoRendicion
                FROM MovimientosViaticos mv
                LEFT JOIN Rendiciones r ON mv.RendicionId = r.Id
                WHERE mv.ViaticoId = @viaticoId
                ORDER BY mv.Fecha DESC
            `);

		res.json(result.recordset);
	} catch (error) {
		console.error('Error movimientos:', error);
		res.status(500).json({ error: 'Error al obtener movimientos' });
	}
});

// ===================================================================================
// EXPORTACIÓN EXCEL
// ===================================================================================

app.get('/api/rendiciones/:id/export-excel', authenticateToken, async (req, res) => {
	try {
		const pool = await poolPromise;
		const rendicionId = parseInt(req.params.id);

		const result = await pool
			.request()
			.input('rendicionId', sql.Int, rendicionId)
			.execute('sp_ObtenerDetalleRendicion');

		if (result.recordsets[0].length === 0) {
			return res.status(404).json({ error: 'Rendición no encontrada' });
		}

		const rendicion = result.recordsets[0][0];
		const gastos = result.recordsets[1];

		if (req.user.role !== 'admin' && rendicion.UsuarioId !== req.user.id) {
			return res.status(403).json({ error: 'Sin permisos' });
		}

		// Crear Excel
		const workbook = new ExcelJS.Workbook();
		const worksheet = workbook.addWorksheet('Rendición Viáticos');

		// Configurar columnas
		worksheet.columns = [
			{ width: 20 },
			{ width: 25 },
			{ width: 15 },
			{ width: 15 },
			{ width: 15 },
			{ width: 15 },
			{ width: 25 },
			{ width: 12 },
			{ width: 30 },
		];

		// Título
		worksheet.mergeCells('A1:I1');
		const titleCell = worksheet.getCell('A1');
		titleCell.value = 'RENDICIÓN DE VIÁTICOS';
		titleCell.font = { size: 16, bold: true };
		titleCell.alignment = { horizontal: 'center' };

		// Información
		worksheet.getCell('A3').value = 'Código:';
		worksheet.getCell('B3').value = rendicion.CodigoRendicion;
		worksheet.getCell('A4').value = 'Empleado:';
		worksheet.getCell('B4').value = rendicion.NombreEmpleado;
		worksheet.getCell('A5').value = 'Fecha:';
		worksheet.getCell('B5').value = new Date(
			rendicion.FechaCreacion
		).toLocaleDateString('es-DO');

		if (rendicion.Estado || rendicion.EstadoPersonalizado) {
			worksheet.getCell('A6').value = 'Estado:';
			worksheet.getCell('B6').value =
				rendicion.EstadoPersonalizado || rendicion.Estado;
		}

		// Encabezados
		const headers = [
			'Empleado',
			'Tipo de Gasto',
			'Nº de Cuenta',
			'Importe sin ITBIS',
			'ITBIS 18%',
			'Total Gasto',
			'Cliente',
			'Fecha',
			'Descripción',
		];

		headers.forEach((header, index) => {
			const cell = worksheet.getCell(8, index + 1);
			cell.value = header;
			cell.font = { bold: true };
			cell.fill = {
				type: 'pattern',
				pattern: 'solid',
				fgColor: { argb: 'FFE6E6E6' },
			};
			cell.border = {
				top: { style: 'thin' },
				left: { style: 'thin' },
				bottom: { style: 'thin' },
				right: { style: 'thin' },
			};
		});

		// Datos
		let currentRow = 9;
		let totalSinItbis = 0;
		let totalItbis = 0;

		gastos.forEach((gasto) => {
			worksheet.getCell(currentRow, 1).value = rendicion.NombreEmpleado;
			worksheet.getCell(currentRow, 2).value = gasto.TipoGasto;
			worksheet.getCell(currentRow, 3).value = gasto.Cuenta;
			worksheet.getCell(currentRow, 4).value = gasto.ImporteSinItbis;
			worksheet.getCell(currentRow, 5).value = gasto.Itbis;
			worksheet.getCell(currentRow, 6).value = gasto.ImporteSinItbis + gasto.Itbis;
			worksheet.getCell(currentRow, 7).value = gasto.Cliente;
			worksheet.getCell(currentRow, 8).value = new Date(
				gasto.Fecha
			).toLocaleDateString('es-DO');
			worksheet.getCell(currentRow, 9).value = gasto.Descripcion;

			// Formato moneda
			[4, 5, 6].forEach((col) => {
				const cell = worksheet.getCell(currentRow, col);
				cell.numFmt = '$#,##0.00';
				cell.alignment = { horizontal: 'right' };
			});

			// Bordes
			for (let col = 1; col <= 9; col++) {
				const cell = worksheet.getCell(currentRow, col);
				cell.border = {
					top: { style: 'thin' },
					left: { style: 'thin' },
					bottom: { style: 'thin' },
					right: { style: 'thin' },
				};
			}

			totalSinItbis += gasto.ImporteSinItbis;
			totalItbis += gasto.Itbis;
			currentRow++;
		});

		// Totales
		currentRow += 1;
		worksheet.getCell(currentRow, 3).value = 'TOTALES:';
		worksheet.getCell(currentRow, 3).font = { bold: true };
		worksheet.getCell(currentRow, 4).value = totalSinItbis;
		worksheet.getCell(currentRow, 5).value = totalItbis;
		worksheet.getCell(currentRow, 6).value = totalSinItbis + totalItbis;

		[4, 5, 6].forEach((col) => {
			const cell = worksheet.getCell(currentRow, col);
			cell.numFmt = '$#,##0.00';
			cell.font = { bold: true };
			cell.alignment = { horizontal: 'right' };
		});

		// Respuesta
		res.setHeader(
			'Content-Type',
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
		);
		res.setHeader(
			'Content-Disposition',
			`attachment; filename="Rendicion_Viaticos_${
				rendicion.CodigoRendicion
			}_${new Date().toISOString().slice(0, 10)}.xlsx"`
		);

		await workbook.xlsx.write(res);
		res.end();
	} catch (error) {
		console.error('Error exportando Excel:', error);
		res.status(500).json({ error: 'Error al exportar' });
	}
});

// ===================================================================================
// MANTENIMIENTO CRUD (Solo Admin)
// ===================================================================================

// Usuarios
app.get('/api/usuarios', [authenticateToken, isAdmin], async (req, res) => {
	try {
		const pool = await poolPromise;
		const result = await pool.request().query(`
            SELECT Id, NombreCompleto, Username, Role, FechaCreacion, Activo
            FROM Usuarios WHERE Activo = 1 ORDER BY NombreCompleto
        `);
		res.json(result.recordset);
	} catch (error) {
		res.status(500).json({ error: 'Error al obtener usuarios' });
	}
});

app.post('/api/usuarios', [authenticateToken, isAdmin], async (req, res) => {
	try {
		const { nombreCompleto, username, password, role } = req.body;
		const pool = await poolPromise;

		const result = await pool
			.request()
			.input('nombreCompleto', sql.NVarChar, nombreCompleto)
			.input('username', sql.NVarChar, username)
			.input('password', sql.NVarChar, password)
			.input('role', sql.NVarChar, role).query(`
                INSERT INTO Usuarios (NombreCompleto, Username, Password, Role)
                OUTPUT INSERTED.Id VALUES (@nombreCompleto, @username, @password, @role)
            `);

		res.status(201).json({ id: result.recordset[0].Id, message: 'Usuario creado' });
	} catch (error) {
		if (error.number === 2627) {
			res.status(400).json({ error: 'Username ya existe' });
		} else {
			res.status(500).json({ error: 'Error al crear usuario' });
		}
	}
});

// Manejo de errores
app.use((req, res) => {
	res.status(404).json({ error: 'Endpoint no encontrado' });
});

// Iniciar servidor
const startServer = async () => {
	try {
		await initializeDatabase();
		app.listen(PORT, () => {
			console.log(`🚀 Servidor en http://localhost:${PORT}`);
		});
	} catch (error) {
		console.error('❌ Error al iniciar:', error);
		process.exit(1);
	}
};

startServer();
