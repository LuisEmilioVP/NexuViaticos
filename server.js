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
const SECRET_KEY = process.env.SECRET_KEY || 'tu-clave-super-secreta';

// Configuración de la base de datos
const dbConfig = {
	user: process.env.DB_USER || 'sa',
	password: process.env.DB_PASSWORD || 'YourPassword123',
	server: process.env.DB_SERVER || 'ESMERALDASOFTSQLEXPRESS',
	database: process.env.DB_DATABASE || 'RendicionGastos',
	options: {
		encrypt: process.env.DB_ENCRYPT === 'true' || false,
		trustServerCertificate: process.env.DB_TRUST_CERT === 'true' || true,
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

// Variable global para el pool de conexiones
let poolPromise;

// ===================================================================================
// CONFIGURACIÓN DE BASE DE DATOS
// ===================================================================================

const initializeDatabase = async () => {
	try {
		poolPromise = new sql.ConnectionPool(dbConfig)
			.connect()
			.then((pool) => {
				console.log('✅ Conectado a SQL Server');
				return pool;
			})
			.catch((err) => {
				console.error('❌ Error de conexión a la base de datos:', err);
				process.exit(1);
			});
	} catch (error) {
		console.error('❌ Error al inicializar la base de datos:', error);
		process.exit(1);
	}
};

// ===================================================================================
// ENDPOINT PARA SERVIR LA APLICACIÓN
// ===================================================================================

app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===================================================================================
// MANEJO DE ERRORES GLOBAL
// ===================================================================================

app.use((err, req, res, next) => {
	console.error('Error no manejado:', err);
	res.status(500).json({ error: 'Error interno del servidor' });
});

// RUTA CATCH-ALL PARA 404
app.use((req, res) => {
	res.status(404).json({ error: 'Endpoint no encontrado' });
});

// ===================================================================================
// INICIO DEL SERVIDOR
// ===================================================================================

const startServer = async () => {
	try {
		await initializeDatabase();

		app.listen(PORT, () => {
			console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
			console.log(
				`📁 Sirviendo archivos estáticos desde: ${path.join(__dirname, 'public')}`
			);
		});
	} catch (error) {
		console.error('❌ Error al iniciar el servidor:', error);
		process.exit(1);
	}
};

// Manejo graceful de cierre
process.on('SIGINT', async () => {
	console.log('\n⏹️  Cerrando servidor...');
	try {
		const pool = await poolPromise;
		await pool.close();
		console.log('✅ Conexión a base de datos cerrada');
	} catch (error) {
		console.error('❌ Error cerrando conexión:', error);
	}
	process.exit(0);
});

startServer();
