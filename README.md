# Sistema de Rendición de Gastos v1.0

Sistema web para gestión de rendiciones de gastos empresariales con integración SQL Server y exportación Excel automatizada.

## 🚀 Características

- **Autenticación JWT** con roles (admin/user)
- **Base de datos SQL Server** con procedimientos almacenados
- **Estados personalizables** de rendición
- **Exportación Excel** con formato oficial
- **CRUD completo** para mantenimiento de datos
- **API REST** documentada
- **Interfaz responsiva** moderna

## 📋 Prerrequisitos

- Node.js 16+
- SQL Server Express/Standard
- npm o yarn

## 🔧 Instalación

### 1. Clonar y configurar proyecto

```bash
git clone <repo-url>
cd sistema-rendicion-gastos
npm install
```

### 2. Configurar base de datos

```bash
# Ejecutar script SQL en SQL Server Management Studio
# o usando sqlcmd:
sqlcmd -S localhost -d master -i database.sql
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con tus credenciales
```

### 4. Iniciar aplicación

```bash
npm run dev
```

Abrir http://localhost:3000

## 👤 Usuarios de prueba

| Usuario | Contraseña | Rol           |
| ------- | ---------- | ------------- |
| admin   | admin123   | Administrador |
| demo    | demo123    | Usuario       |

## 🗂️ Estructura API

### Autenticación

- `POST /api/login` - Iniciar sesión

### Rendiciones

- `GET /api/rendiciones` - Listar rendiciones
- `POST /api/rendiciones` - Crear rendición
- `GET /api/rendiciones/:id` - Detalle de rendición
- `GET /api/rendiciones/:id/export-excel` - Exportar Excel

### Mantenimiento (Admin)

- `GET|POST|PUT|DELETE /api/usuarios` - CRUD usuarios
- `GET|POST|PUT|DELETE /api/clientes` - CRUD clientes
- `GET|POST|PUT|DELETE /api/sucursales` - CRUD sucursales
- `GET|POST|PUT|DELETE /api/tipos-gastos` - CRUD tipos de gastos

### Datos

- `GET /api/initial-data` - Datos iniciales para combos

## 📊 Estados de Rendición

- **Implementación**
- **Salida a Producción**
- **Reparación**
- **Entrega de equipo**
- **Otro** (personalizable)

## 🔒 Seguridad

- Tokens JWT con expiración 8h
- Validación de roles por endpoint
- Sanitización de datos SQL
- Headers de seguridad CORS

## 📁 Exportación Excel

El sistema genera archivos Excel con formato idéntico al modelo "Rendición Viáticos", incluyendo:

- Encabezados oficiales
- Formato de moneda
- Totalizadores automáticos
- Información del empleado y estado

## 🛠️ Desarrollo

### Scripts disponibles

```bash
npm run dev      # Desarrollo con nodemon
npm start        # Producción
npm run install-db # Instalar BD (requiere sqlcmd)
```

### Estructura de archivos

```
├── server.js          # Servidor Express + API
├── database.sql       # Script SQL Server
├── package.json       # Dependencias
├── .env              # Variables de entorno
└── public/           # Frontend
    ├── index.html    # HTML principal
    ├── css/style.css # Estilos
    └── js/app.js     # Lógica frontend
```

## 🔧 Configuración avanzada

### Variables de entorno (.env)

```env
PORT=3000
SECRET_KEY=tu-clave-secreta
DB_SERVER=localhost
DB_DATABASE=RendicionGastos
DB_USER=sa
DB_PASSWORD=tu-password
DB_ENCRYPT=false
DB_TRUST_CERT=true
```

### Para Azure SQL Database

```env
DB_SERVER=tu-servidor.database.windows.net
DB_ENCRYPT=true
DB_TRUST_CERT=false
```

## 📝 Licencia

MIT License - ver archivo LICENSE

## 🤝 Contribución

1. Fork el proyecto
2. Crear branch feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push al branch (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## 🐛 Reporte de bugs

Crear issue en GitHub con:

- Descripción del problema
- Pasos para reproducir
- Comportamiento esperado vs actual
- Screenshots si aplica

## 📞 Soporte

Para consultas técnicas o soporte, contactar al equipo de desarrollo.
