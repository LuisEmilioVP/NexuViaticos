# Configuración de Seguridad - Base de Datos

## 👥 Usuarios Dedicados

| Usuario   | Contraseña         | Propósito             | Permisos |
| --------- | ------------------ | --------------------- | -------- |
| `soft_db` | `SoftDB2024!Admin` | Aplicación principal  | db_owner |
| `soft_ad` | `SoftAD2024!Admin` | Administración/backup | db_owner |

## 🔧 Comandos de Configuración

### Crear usuarios (ejecutar como SA)

```sql
sqlcmd -S localhost\SQLEXPRESS -i create_db_users.sql
```

### Verificar usuarios

```sql
SELECT name, type_desc FROM sys.database_principals
WHERE name IN ('soft_db', 'soft_ad');
```

### Cambiar contraseñas

```sql
ALTER LOGIN soft_db WITH PASSWORD = 'NuevaPassword123!';
ALTER LOGIN soft_ad WITH PASSWORD = 'NuevaPassword123!';
```

## ⚙️ Configuración .env

**Producción:**

```env
DB_USER=soft_db
DB_PASSWORD=SoftDB2024!Admin
```

**Administración:**

```env
DB_USER=soft_ad
DB_PASSWORD=SoftAD2024!Admin
```

## 🛡️ Mejores Prácticas

- Cambiar contraseñas por defecto en producción
- Usar `soft_db` para la aplicación
- Usar `soft_ad` solo para mantenimiento
- Rotar contraseñas cada 6 meses
- Nunca usar SA en aplicaciones
