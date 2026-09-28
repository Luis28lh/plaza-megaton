# SISTEMA DE GESTIÓN – PLAZA MEGATÓN

**Plataforma Web Móvil-First para la Administración Inmobiliaria de Plaza Megatón**

Diseñada para registrar propietarios e inquilinos mediante código QR, gestionar solicitudes y reclamaciones de mantenimiento con evidencias fotográficas, conciliar pagos con comprobantes bancarios (vouchers) y emitir notificaciones automáticas por correo electrónico con identidad corporativa roja.

---

## 🌐 Estándar Mandatorio: Publicación Remota y Versionado Continuo
> **Política Operativa:** Todo desarrollo completado se envía de forma inmediata al repositorio remoto en GitHub (`Luis28lh`) y se publica en Internet para permitir acceso, pruebas y operación móvil continua desde el exterior (Android, iPhone, tablet o PC) sin restricciones de red local.

### 🔗 Enlaces Públicos en Vivo (Acceso Móvil / Remoto)
* 🏠 **Portal de Inicio:** [https://luis28lh.github.io/wes-plataforma/plaza-megaton/index.html](https://luis28lh.github.io/wes-plataforma/plaza-megaton/index.html)
* 📱 **Formulario QR Directo:** [https://luis28lh.github.io/wes-plataforma/plaza-megaton/registro.html](https://luis28lh.github.io/wes-plataforma/plaza-megaton/registro.html)
* 🛠️ **Solicitudes y Reclamaciones:** [https://luis28lh.github.io/wes-plataforma/plaza-megaton/solicitudes.html](https://luis28lh.github.io/wes-plataforma/plaza-megaton/solicitudes.html)
* 💳 **Reporte de Pagos:** [https://luis28lh.github.io/wes-plataforma/plaza-megaton/pagos.html](https://luis28lh.github.io/wes-plataforma/plaza-megaton/pagos.html)
* 📋 **Mis Solicitudes:** [https://luis28lh.github.io/wes-plataforma/plaza-megaton/mis-solicitudes.html](https://luis28lh.github.io/wes-plataforma/plaza-megaton/mis-solicitudes.html)
* 💰 **Mis Pagos:** [https://luis28lh.github.io/wes-plataforma/plaza-megaton/mis-pagos.html](https://luis28lh.github.io/wes-plataforma/plaza-megaton/mis-pagos.html)
* 💼 **Panel Administrativo:** [https://luis28lh.github.io/wes-plataforma/plaza-megaton/admin.html](https://luis28lh.github.io/wes-plataforma/plaza-megaton/admin.html) *(PIN: `megaton2026`)*

---

## 🚀 Características Principales

1. **📱 Experiencia Móvil-First:**
   - Botones táctiles de gran tamaño (mínimo 48px).
   - Selector interactivo de cubículos con chips táctiles.
   - Carga directa desde la cámara del celular (`capture="environment"`).
   - Compresión automática de imágenes en el navegador mediante Canvas antes de subir (reduce fotos de 8MB a ~250KB en milisegundos).
   - Prevención de doble clic y retroalimentación inmediata.

2. **📝 Registro Inicial mediante QR:**
   - Diseñado para reuniones de propietarios e inquilinos sin instalar ninguna aplicación.
   - Escaneo de QR ➔ Formulario web directo ➔ Confirmación en pantalla ➔ Despacho de correo de bienvenida.
   - Permite vincular uno o múltiples cubículos a un mismo usuario.
   - Actualiza automáticamente el estado de los cubículos a "Ocupado".

3. **🔑 Autenticación Segura sin Contraseñas (Magic Link):**
   - El correo electrónico es la llave única del usuario.
   - Generación de enlaces temporales de acceso (un solo uso, caducidad de 60 minutos).
   - Aislamiento de privacidad: ningún usuario puede ver reclamaciones o pagos de otros.

4. **🛠️ Módulo de Solicitudes y Reclamaciones:**
   - Generador consecutivo inviolable de correlativos: `CL-001`, `CL-002`, `CL-003`, etc.
   - Filtro automático: solo muestra los cubículos pertenecientes al usuario autenticado.
   - Registro de fotos organizadas en carpetas por código (`PLAZA MEGATÓN / 01 - RECLAMACIONES / CL-xxx /`).
   - Flujo de estados: *Recibida*, *En revisión*, *Asignada*, *En proceso*, *Pendiente de información*, *Resuelta*, *Cerrada*, *Cancelada*.
   - Correo automático al usuario tras registrarse y tras cualquier cambio de estado.

5. **💳 Módulo de Reporte de Pagos:**
   - Generador consecutivo: `PG-001`, `PG-002`, `PG-003`, etc.
   - Soporte para comprobantes/vouchers en JPG, PNG y PDF.
   - Carpetas organizadas (`PLAZA MEGATÓN / 02 - PAGOS / PG-xxx /`).
   - Flujo administrativo: *Reportado*, *En revisión*, *Confirmado*, *Rechazado*, *Pendiente de información*.
   - Notificación de confirmación o rechazo con observaciones administrativas al usuario.

6. **📜 Auditoría e Historial de Movimientos:**
   - Registro inmutable de cada cambio de estado, nota administrativa y conciliación de pago.

7. **💼 Portal Administrativo Completo (`/admin`):**
   - Acceso protegido por PIN (predeterminado: `megaton2026`).
   - Dashboard en tiempo real con KPIs de ocupación, usuarios, reclamos y finanzas.
   - Gestión integral de usuarios (asociar/desasociar cubículos, activar/desactivar).
   - Gestión de reclamaciones (ver fotos, cambiar estado, asignar técnico, solución).
   - Conciliación de pagos con visor modal de voucher (zoom de imagen o PDF).
   - Generador y visor de Código QR con descarga de imagen PNG y botón de impresión de cartel.
   - Configuración editable de datos de la plaza y correo.

---

## 📁 Estructura del Proyecto

```
plaza-megaton/
├── server.js                      # Servidor backend Express con API REST y subida de archivos
├── package.json                   # Dependencias de producción
├── .env.example                   # Plantilla de variables de entorno
├── README.md                      # Documentación maestra
├── database/
│   ├── initial_catalog.json       # Catálogo maestro de cubículos C-001 a C-030 y configuración
│   └── local_db.json              # Base de datos local persistente estructurada
├── services/
│   ├── dataService.js             # Repositorio desacoplado (Local DB / Google Sheets / SQL)
│   ├── sequenceService.js         # Generador de correlativos inviolables (US-xxx, CL-xxx, PG-xxx)
│   ├── googleDriveService.js      # Almacenamiento organizado por carpetas CL-xxx y PG-xxx
│   ├── googleAppsScriptBridge.js  # Conector opcional para Webhook de Google Apps Script
│   ├── emailService.js            # Servicio de notificaciones con plantilla roja corporativa
│   └── authService.js             # Magic links y tokens de sesión
├── google-apps-script/
│   └── Code.gs                    # Script listo para copiar y pegar en Google Sheets
└── public/
    ├── index.html                 # Pantalla de inicio con tarjetas de acceso rápido
    ├── registro.html              # Formulario QR de registro
    ├── solicitudes.html           # Módulo de reclamaciones con evidencias fotográficas
    ├── pagos.html                 # Módulo de reporte de pagos y vouchers
    ├── mis-solicitudes.html       # Consulta personal de solicitudes
    ├── mis-pagos.html             # Consulta personal de pagos
    ├── login.html                 # Acceso por correo (Magic Link)
    ├── admin.html                 # Portal administrativo (/admin)
    ├── css/
    │   ├── styles.css             # Identidad visual roja y diseño responsive móvil
    │   └── admin.css              # Estilos del panel administrativo
    ├── js/
    │   ├── app.js                 # Manejador global, sesión y compresión de fotos Canvas
    │   ├── registro.js            # Controlador de registro
    │   ├── solicitudes.js         # Controlador de solicitudes
    │   ├── pagos.js               # Controlador de pagos
    │   ├── mis-solicitudes.js     # Controlador de mis solicitudes
    │   ├── mis-pagos.js           # Controlador de mis pagos
    │   ├── login.js               # Controlador de login
    │   └── admin.js               # Controlador del portal de administración
    └── assets/
        ├── logo-megaton.svg       # Logo vectorizado Plaza Megatón
        └── uploads/               # Carpetas organizadas de evidencias y vouchers
```

---

## 🛠️ Instalación y Puesta en Marcha Local

### 1. Requisitos
- Node.js (versión 18 o superior).

### 2. Iniciar el Servidor
Abre PowerShell o terminal en la carpeta del proyecto:

```powershell
cd "c:\Users\User\Desktop\TALLER WEB\plaza-megaton"
npm install
node server.js
```

El sistema iniciará en:
- **Portal Público:** `http://localhost:3007/`
- **Registro QR Directo:** `http://localhost:3007/registro.html`
- **Portal Administrativo:** `http://localhost:3007/admin.html` (PIN: `megaton2026`)

---

## ☁️ Conexión con Google Sheets y Google Drive

El sistema está diseñado para funcionar **al 100% de manera inmediata** con su almacenamiento local persistente (`database/local_db.json`), manteniendo la misma estructura de 7 pestañas.

Para conectarlo con tu cuenta oficial de Google Sheets y Google Drive:

### Opción Rápida: Google Apps Script (Recomendada, sin necesidad de cuenta GCP)
1. Crea una hoja de cálculo en tu Google Drive llamada: `PLAZA_MEGATON_DATABASE`.
2. Ve al menú **Extensiones** > **Apps Script**.
3. Pega todo el contenido de [`google-apps-script/Code.gs`](./google-apps-script/Code.gs).
4. Ejecuta la función `inicializarBaseDeDatos()` una vez para crear las 7 pestañas con sus formatos y las carpetas de Google Drive.
5. Haz clic en **Implementar** > **Nueva implementación** > Tipo: **Aplicación web**.
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier persona**
6. Copia la URL generada y agrégala a tu archivo `.env`:
   ```env
   GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/TU_SCRIPT_ID/exec
   ```

---

## 📧 Configuración de Correo Electrónico

Si no defines credenciales SMTP en `.env`, el servidor genera automáticamente un **buzón seguro de pruebas en Ethereal**, imprimiendo el enlace directo para previsualizar los correos enviados en la consola y en la interfaz.

Para utilizar tu cuenta oficial de Gmail / Plaza Megatón:
1. En tu cuenta de Google, activa la verificación en dos pasos y genera una **Contraseña de Aplicación** (16 caracteres).
2. Configura en `.env`:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=administracion@plazamegaton.com
   SMTP_PASS=tu_contraseña_de_aplicacion
   ```

---

## 🧪 Pruebas Obligatorias Validadas

| Módulo | Prueba Realizada | Resultado |
| :--- | :--- | :---: |
| **Registro QR** | Usuario vincula cubículo C-001 | ✅ Exitoso (Genera US-001) |
| **Multi-cubículos** | Usuario vincula simultáneamente C-010 y C-015 | ✅ Exitoso (Ambos asignados) |
| **Catálogo** | Cubículos asignados pasan a estado *Ocupado* | ✅ Exitoso |
| **Correo Bienvenida** | Envío de correo corporativo con lista de cubículos | ✅ Exitoso |
| **Reclamación** | Generación de código correlativo `CL-001` y `CL-002` | ✅ Inviolable |
| **Fotografías** | Compresión en cliente y guardado en `01 - RECLAMACIONES/CL-xxx/` | ✅ Exitoso |
| **Pago** | Generación de código correlativo `PG-001` y comprobante | ✅ Exitoso |
| **Seguridad** | Aislamiento de consultas por usuario (Magic Link) | ✅ Protegido |
| **Panel Admin** | KPIs en tiempo real, cambio de estado con notificación y visor QR | ✅ 100% Funcional |
