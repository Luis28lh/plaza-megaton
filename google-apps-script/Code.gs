/**
 * SISTEMA DE GESTIÓN – PLAZA MEGATÓN
 * Google Apps Script v3.0 — Base de Datos Oficial (Catálogo Maestro, Propietarios y Presupuesto 2026)
 * 
 * Funcionalidades automáticas:
 * 1. Carpeta raíz en Google Drive: "PLAZA MEGATÓN"
 * 2. Base de datos centralizada: "PLAZA_MEGATON_DATABASE"
 * 3. 33 Locales Oficiales (Primer, Segundo y Tercer Nivel) con M2, Precio/M2 y Cuota de Mantenimiento.
 * 4. Pestaña oficial "PRESUPUESTO_2026" con ingresos por nivel y egresos detallados.
 * 5. Registro automático de propietarios con RNC y cubículos asociados.
 * 6. Subcarpetas organizadas para evidencias y comprobantes.
 * 7. Envío de correos oficiales con enlace directo al portal público.
 */

var FOLDER_NAME = 'PLAZA MEGATÓN';
var DATABASE_NAME = 'PLAZA_MEGATON_DATABASE';
var DATABASE_SPREADSHEET_ID = '1_pHnJkeyVTbVfXacVOFIsKDYb3vaP-EBepc3tm3CQKY';
var ROOT_FOLDER_ID = '1CUUpP7K2roI8cemURppsB5QyPm6WAgpY';
var DEFAULT_PORTAL_URL = 'https://luis28lh.github.io/plaza-megaton/index.html';

// CATÁLOGO MAESTRO OFICIAL DE LOCALES
var MASTER_CUBICULOS = [
  // PRIMER NIVEL
  ['CUB-A101', 'A-101', 'Primer Nivel', 64.75, 100.00, 6475.00, 'Yesenia Grullón', 'Comercial / Administrativo', 'Ocupado', 'YESENIA GRULLON', '', 'Primer Nivel - Local Principal'],
  ['CUB-A102', 'A-102', 'Primer Nivel', 54.95, 100.00, 5495.00, 'Alba María García Rodríguez', 'Servicios Profesionales', 'Ocupado', 'ALBA MARIA GARCIA RODRIGUEZ', '131516238', 'Primer Nivel - RNC 131516238'],
  ['CUB-A103', 'A-103', 'Primer Nivel', 170.24, 60.00, 10214.40, 'Consultorio Dra. Melissa', 'Servicios Médicos / Salud', 'Ocupado', 'DR. MELISSA', '', 'Primer Nivel - Área Médica'],
  ['CUB-A104', 'A-104', 'Primer Nivel', 78.26, 100.00, 7826.00, 'Warn Electrical Services SRL', 'Seguridad Electrónica, Automatización e Instalaciones', 'Ocupado', 'WARN ELECTRICAL SERVICES SRL', '130161267', 'Primer Nivel - Sede WES'],
  ['CUB-A105', 'A-105', 'Primer Nivel', 223.45, 35.00, 7820.75, 'Armería La Mocana SRL - Pablo Abreu', 'Comercio Especializado / Armería', 'Ocupado', 'ARMERIA LA MOCANA SRL - PABLO ABREU', '130060398', 'Primer Nivel - RNC 130060398'],
  ['CUB-A105A', 'A-105-A', 'Primer Nivel', 293.55, 35.00, 10274.25, 'Bingo', 'Entretenimiento / Juegos', 'Ocupado', 'EDWAR GRULLON', '130161267', 'Primer Nivel - Sala de Bingo'],

  // SEGUNDO NIVEL
  ['CUB-A201', 'A-201', 'Segundo Nivel', 115.20, 60.00, 6912.00, 'INABIE', 'Institucional / Gubernamental', 'Ocupado', 'INABIE', '130161267', 'Segundo Nivel - Oficinas INABIE'],
  ['CUB-A202', 'A-202', 'Segundo Nivel', 32.88, 100.00, 3288.00, 'Luis María García', 'Comercial', 'Ocupado', 'LUIS MARIA GARCIA', '', 'Segundo Nivel'],
  ['CUB-A203', 'A-203', 'Segundo Nivel', 34.18, 100.00, 3418.00, 'Jet Pack', 'Envíos / Paquetería / Courier', 'Ocupado', 'MANUEL SANTOS', '', 'Segundo Nivel - Jet Pack'],
  ['CUB-A204', 'A-204', 'Segundo Nivel', 30.83, 100.00, 3083.00, 'Manuel Santos', 'Comercial / Oficina', 'Ocupado', 'MANUEL SANTOS', '', 'Segundo Nivel'],
  ['CUB-A205', 'A-205', 'Segundo Nivel', 13.55, 100.00, 1355.00, 'Centro de Uña', 'Estética y Belleza / Salón de Uñas', 'Ocupado', 'ELDA BENCOSME', '', 'Segundo Nivel - Salón'],
  ['CUB-A206', 'A-206', 'Segundo Nivel', 66.69, 31.00, 2067.39, 'Alba Rodríguez & Asociados, SRL', 'Consultoría / Servicios Legales y Financieros', 'Ocupado', 'ALBA RODRIGUEZ & ASOCIADOS, SRL', '131262589', 'Segundo Nivel - RNC 131262589'],
  ['CUB-A207', 'A-207', 'Segundo Nivel', 65.14, 31.00, 2019.34, 'Alba Rodríguez & Asociados, SRL', 'Consultoría / Servicios Legales y Financieros', 'Ocupado', 'ALBA RODRIGUEZ & ASOCIADOS, SRL', '131262589', 'Segundo Nivel - RNC 131262589'],
  ['CUB-A208', 'A-208', 'Segundo Nivel', 80.05, 100.00, 8005.00, 'Nicolás Grullón', 'Comercial', 'Ocupado', 'NICOLAS GRULLON', '', 'Segundo Nivel'],
  ['CUB-A209', 'A-209', 'Segundo Nivel', 79.99, 60.00, 4799.40, 'Ahsdiel Music Bar SRL', 'Bar / Lounge / Entretenimiento', 'Ocupado', 'AHSDIEL MUSIC BAR SRL', '132080211', 'Segundo Nivel - RNC 132080211'],
  ['CUB-A210', 'A-210', 'Segundo Nivel', 84.42, 60.00, 5065.20, 'Ahsdiel Music Bar SRL', 'Bar / Lounge / Entretenimiento', 'Ocupado', 'AHSDIEL MUSIC BAR SRL', '130161267', 'Segundo Nivel - RNC 130161267'],

  // TERCER NIVEL
  ['CUB-A301A', 'A-301-A', 'Tercer Nivel', 34.37, 100.00, 3437.00, 'Vipsania Grullón', 'Comercial / Administrativo', 'Ocupado', 'VIPSANIA GRULLON', '130161267', 'Tercer Nivel - Módulo A'],
  ['CUB-A301B', 'A-301-B', 'Tercer Nivel', 15.32, 100.00, 1532.00, 'Vipsania Grullón', 'Comercial / Administrativo', 'Ocupado', 'VIPSANIA GRULLON', '130161267', 'Tercer Nivel - Módulo B'],
  ['CUB-A301C', 'A-301-C', 'Tercer Nivel', 11.05, 100.00, 1105.00, 'Vipsania Grullón', 'Comercial / Administrativo', 'Ocupado', 'VIPSANIA GRULLON', '130161267', 'Tercer Nivel - Módulo C'],
  ['CUB-A301D', 'A-301-D', 'Tercer Nivel', 9.69, 100.00, 969.00, 'Vipsania Grullón', 'Comercial / Administrativo', 'Ocupado', 'VIPSANIA GRULLON', '130161267', 'Tercer Nivel - Módulo D'],
  ['CUB-A302', 'A-302', 'Tercer Nivel', 43.53, 31.00, 1349.43, 'Grupo de Desarrollo Internacional', 'Desarrollo Inmobiliario / Proyectos', 'Ocupado', 'GRUPO DE DESARROLLO INTERNACIONAL', '106014788', 'Tercer Nivel - Local 302'],
  ['CUB-A303', 'A-303', 'Tercer Nivel', 43.92, 31.00, 1361.52, 'Grupo de Desarrollo Internacional', 'Desarrollo Inmobiliario / Proyectos', 'Ocupado', 'GRUPO DE DESARROLLO INTERNACIONAL', '106014788', 'Tercer Nivel - Local 303'],
  ['CUB-A304', 'A-304', 'Tercer Nivel', 34.90, 31.00, 1081.90, 'Grupo de Desarrollo Internacional', 'Desarrollo Inmobiliario / Proyectos', 'Ocupado', 'GRUPO DE DESARROLLO INTERNACIONAL', '106014788', 'Tercer Nivel - Local 304'],
  ['CUB-A305', 'A-305', 'Tercer Nivel', 39.26, 31.00, 1217.06, 'Grupo de Desarrollo Internacional', 'Desarrollo Inmobiliario / Proyectos', 'Ocupado', 'GRUPO DE DESARROLLO INTERNACIONAL', '106014788', 'Tercer Nivel - Local 305'],
  ['CUB-A306', 'A-306', 'Tercer Nivel', 33.93, 31.00, 1051.83, 'Grupo de Desarrollo Internacional', 'Desarrollo Inmobiliario / Proyectos', 'Ocupado', 'GRUPO DE DESARROLLO INTERNACIONAL', '106014788', 'Tercer Nivel - Local 306'],
  ['CUB-A307', 'A-307', 'Tercer Nivel', 202.43, 31.00, 6275.33, 'Grupo de Desarrollo Internacional', 'Desarrollo Inmobiliario / Proyectos', 'Ocupado', 'GRUPO DE DESARROLLO INTERNACIONAL', '106014788', 'Tercer Nivel - Local 307'],
  ['CUB-A307ANT', 'A-307-ANT', 'Tercer Nivel', 335.77, 31.00, 10408.87, 'Esward-Sotea, Antena', 'Telecomunicaciones / Azotea', 'Ocupado', 'EDWARD GRULLON', '131712541', 'Tercer Nivel / Azotea - Antena'],
  ['CUB-A307COF', 'A-307-COF', 'Tercer Nivel', 22.62, 180.00, 4071.60, 'Mega Coffy', 'Cafetería / Bebidas y Snacks', 'Ocupado', 'NICOLAS GRULLON', '132080211', 'Tercer Nivel - Mega Coffy'],
  ['CUB-A308', 'A-308', 'Tercer Nivel', 62.23, 60.00, 3733.80, 'Bertha Soury', 'Comercial / Oficina', 'Ocupado', 'BERTHA SOURY', '', 'Tercer Nivel'],
  ['CUB-A309', 'A-309', 'Tercer Nivel', 79.34, 60.00, 4760.40, 'Bertha Soury', 'Comercial / Oficina', 'Ocupado', 'BERTHA SOURY', '', 'Tercer Nivel'],
  ['CUB-A310', 'A-310', 'Tercer Nivel', 1002.06, 31.00, 31063.86, 'B&B Operadora de Filmes & Gym SRL', 'Gimnasio / Fitness / Producción', 'Ocupado', 'B&B OPERADORA DE FILMES & GYM SRL', '131528759', 'Tercer Nivel - 4 secciones (268.89 + 453.02 + 270.48 + 9.67 m2)'],
  ['CUB-A311', 'A-311', 'Tercer Nivel', 47.57, 100.00, 4757.00, 'Elda Bencosme', 'Comercial / Estética', 'Ocupado', 'ELDA BENCOSME', '', 'Tercer Nivel'],
  ['CUB-A312', 'A-312', 'Tercer Nivel', 423.35, 31.00, 5000.00, 'Grupo de Desarrollo Internacional', 'Desarrollo Inmobiliario / Proyectos', 'Ocupado', 'GRUPO DE DESARROLLO INTERNACIONAL', '106014788', 'Tercer Nivel - Local 312']
];

// PRESUPUESTO OFICIAL PERIODO 2026
var PRESUPUESTO_DATA = [
  ['INGRESOS', 'PRIMER NIVEL', 48105.40, 577264.80, 'Cuotas de mantenimiento Primer Nivel'],
  ['INGRESOS', 'SEGUNDO NIVEL', 45208.40, 542500.80, 'Cuotas de mantenimiento Segundo Nivel'],
  ['INGRESOS', 'TERCER NIVEL (BASE)', 44500.00, 533999.96, 'Cuotas de mantenimiento Tercer Nivel (Base)'],
  ['INGRESOS', 'TOTAL INGRESOS BASE', 137813.80, 1653765.56, 'Total mensual y anual recaudación proyectada'],
  ['EGRESOS', 'LIMPIEZA (CONSERJE 2 DE 1/2 TIEMPO IGUALADO)', 42000.00, 504000.00, 'Mantenimiento y aseo de áreas comunes'],
  ['EGRESOS', 'Insumos baños (Papel, jabón, desinfectante, fundas)', 18000.00, 216000.00, 'Suministros sanitarios para usuarios'],
  ['EGRESOS', 'Agua (2 baños públicos, 15-20 m3/mes)', 7000.00, 84000.00, 'Consumo de agua potable'],
  ['EGRESOS', 'Luz área común (iluminación LED + extractores 12h/día)', 12000.00, 144000.00, 'Energía eléctrica pasillos y áreas comunes'],
  ['EGRESOS', 'Imprevisto / administración 23% Sup.', 58813.80, 705765.60, 'Fondo de imprevistos y gestión operativa'],
  ['RESUMEN', 'TOTAL EGRESOS', 137813.80, 1653765.60, 'Total mensual y anual de gastos presupuestados'],
  ['RESUMEN', 'RESULTADO NETO', 0.00, 0.00, 'Presupuesto Equilibrado (Ingresos = Egresos)']
];

function getMegatonSpreadsheet() {
  var ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch(e) {}
  if (!ss && typeof DATABASE_SPREADSHEET_ID !== 'undefined' && DATABASE_SPREADSHEET_ID) {
    try { ss = SpreadsheetApp.openById(DATABASE_SPREADSHEET_ID); } catch(e) {}
  }
  if (!ss) {
    try {
      var files = DriveApp.getFilesByName(DATABASE_NAME);
      if (files.hasNext()) ss = SpreadsheetApp.open(files.next());
    } catch(e) {}
  }
  return ss;
}

/**
 * Inicializa la carpeta en Google Drive, la base de datos y todas las tablas maestras
 */
function inicializarBaseDeDatos() {
  var ss = getMegatonSpreadsheet();
  if (!ss) throw new Error('No se pudo encontrar o abrir la hoja de cálculo ' + DATABASE_NAME);

  var rootFolder = null;
  if (typeof ROOT_FOLDER_ID !== 'undefined' && ROOT_FOLDER_ID) {
    try { rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID); } catch(e) {}
  }
  if (!rootFolder) rootFolder = obtenerOCrearCarpetaDrive(FOLDER_NAME);

  moverArchivoAFolder(ss.getId(), rootFolder);
  obtenerOCrearSubcarpeta(rootFolder, '01 - RECLAMACIONES');
  obtenerOCrearSubcarpeta(rootFolder, '02 - PAGOS');
  obtenerOCrearSubcarpeta(rootFolder, '03 - COPIAS DE SEGURIDAD');

  var tablasDefinidas = [
    {
      nombre: 'CUBICULOS',
      cabeceras: ['cubiculo_id', 'codigo', 'nivel', 'area_m2', 'precio_m2', 'mantenimiento_mensual', 'nombre_local', 'actividad_comercial', 'estado', 'propietario', 'rnc', 'observaciones'],
      datos: MASTER_CUBICULOS
    },
    {
      nombre: 'PRESUPUESTO_2026',
      cabeceras: ['categoria', 'concepto_o_nivel', 'monto_mensual_rd', 'monto_anual_rd', 'observaciones'],
      datos: PRESUPUESTO_DATA
    },
    {
      nombre: 'USUARIOS',
      cabeceras: ['user_id', 'nombre', 'rnc', 'email', 'telefono', 'tipo', 'cubiculos_asociados', 'fecha_registro', 'estado']
    },
    {
      nombre: 'USUARIO_CUBICULO',
      cabeceras: ['id', 'user_id', 'cubiculo_id', 'codigo_local', 'nombre_local', 'actividad_comercial', 'area_m2', 'precio_m2', 'mantenimiento_mensual', 'fecha_asignacion', 'estado']
    },
    {
      nombre: 'RECLAMACIONES',
      cabeceras: ['codigo', 'fecha', 'hora', 'user_id', 'email', 'cubiculo', 'asunto', 'detalle', 'archivos', 'estado', 'responsable', 'fecha_actualizacion']
    },
    {
      nombre: 'PAGOS',
      cabeceras: ['codigo', 'fecha_registro', 'user_id', 'email', 'cubiculo', 'concepto', 'periodo', 'monto', 'fecha_pago', 'referencia', 'voucher', 'estado', 'observaciones']
    },
    {
      nombre: 'HISTORIAL',
      cabeceras: ['id', 'tipo_documento', 'codigo_documento', 'fecha', 'hora', 'usuario', 'accion', 'estado_anterior', 'estado_nuevo', 'observacion']
    },
    {
      nombre: 'CONFIGURACION',
      cabeceras: ['parametro', 'valor']
    }
  ];

  tablasDefinidas.forEach(function(item) {
    var sheet = ss.getSheetByName(item.nombre);
    if (!sheet) {
      sheet = ss.insertSheet(item.nombre);
    }
    
    // Si la hoja está vacía, colocar cabeceras con formato rojo corporativo
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(item.cabeceras);
      sheet.getRange(1, 1, 1, item.cabeceras.length)
        .setFontWeight('bold')
        .setBackground('#D32F2F')
        .setFontColor('#FFFFFF')
        .setHorizontalAlignment('center');
      sheet.setFrozenRows(1);
    }

    // Cargar datos maestros si aplica y está vacía
    if (item.datos && item.datos.length > 0 && sheet.getLastRow() === 1) {
      sheet.getRange(2, 1, item.datos.length, item.cabeceras.length).setValues(item.datos);
    }
  });

  // Generar usuarios y asignaciones basados en MASTER_CUBICULOS si están vacíos
  var sheetUsers = ss.getSheetByName('USUARIOS');
  var sheetUC = ss.getSheetByName('USUARIO_CUBICULO');

  if (sheetUsers && sheetUsers.getLastRow() <= 1 && sheetUC && sheetUC.getLastRow() <= 1) {
    var userMap = {};
    var userRows = [];
    var ucRows = [];

    MASTER_CUBICULOS.forEach(function(row, idx) {
      var prop = row[9];
      var rnc = row[10];
      var cod = row[1];
      var nomLocal = row[6];
      var act = row[7];
      var m2 = row[3];
      var prec = row[4];
      var mant = row[5];

      if (!userMap[prop]) {
        var uId = 'US-' + (Object.keys(userMap).length + 1 < 10 ? '00' : '0') + (Object.keys(userMap).length + 1);
        var clean = prop.toLowerCase().replace(/[^a-z0-9]/g, '.');
        var email = clean + '@plazamegaton.com';
        userMap[prop] = { id: uId, rnc: rnc, email: email, cubiculos: [cod] };
      } else {
        userMap[prop].cubiculos.push(cod);
        if (!userMap[prop].rnc && rnc) userMap[prop].rnc = rnc;
      }

      ucRows.push([
        'UC-' + (idx + 1 < 10 ? '00' : (idx + 1 < 100 ? '0' : '')) + (idx + 1),
        userMap[prop].id,
        row[0],
        cod,
        nomLocal,
        act,
        m2,
        prec,
        mant,
        '28/09/2026',
        'Activo'
      ]);
    });

    Object.keys(userMap).forEach(function(name) {
      var u = userMap[name];
      userRows.push([
        u.id,
        name,
        u.rnc,
        u.email,
        '809-555-0100',
        'Propietario / Inquilino',
        u.cubiculos.join(', '),
        '28/09/2026',
        'Activo'
      ]);
    });

    if (userRows.length > 0) sheetUsers.getRange(2, 1, userRows.length, 9).setValues(userRows);
    if (ucRows.length > 0) sheetUC.getRange(2, 1, ucRows.length, 11).setValues(ucRows);
  }

  // Eliminar la "Hoja 1" por defecto si existe
  var defaultSheet = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch (_) {}
  }

  return {
    success: true,
    folderId: rootFolder.getId(),
    spreadsheetId: ss.getId(),
    tables: ss.getSheets().map(function(s) { return s.getName(); })
  };
}

function obtenerOCrearCarpetaDrive(nombre) {
  var folders = DriveApp.getFoldersByName(nombre);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(nombre);
}

function obtenerOCrearSubcarpeta(parentFolder, nombre) {
  var subFolders = parentFolder.getFoldersByName(nombre);
  return subFolders.hasNext() ? subFolders.next() : parentFolder.createFolder(nombre);
}

function moverArchivoAFolder(fileId, targetFolder) {
  try {
    var file = DriveApp.getFileById(fileId);
    var parents = file.getParents();
    var alreadyIn = false;
    while (parents.hasNext()) {
      var p = parents.next();
      if (p.getId() === targetFolder.getId()) {
        alreadyIn = true;
        break;
      }
    }
    if (!alreadyIn) {
      targetFolder.addFile(file);
      var oldParents = file.getParents();
      while (oldParents.hasNext()) {
        var op = oldParents.next();
        if (op.getId() !== targetFolder.getId()) op.removeFile(file);
      }
    }
  } catch(e) {}
}

function obtenerHoja(nombreHoja) {
  var ss = getMegatonSpreadsheet();
  if (!ss) return null;
  var sheet = ss.getSheetByName(nombreHoja);
  if (!sheet) {
    inicializarBaseDeDatos();
    sheet = ss.getSheetByName(nombreHoja);
  }
  return sheet;
}

/**
 * Webhook para recibir eventos POST desde la web o el servidor Node.js
 */
function doPost(e) {
  try {
    var contents = JSON.parse(e.postData.contents);
    var action = contents.action;
    var payload = contents.payload || {};
    var ss = getMegatonSpreadsheet();

    if (!ss) {
      return responseJSON({ success: false, error: 'No se pudo acceder al Spreadsheet de Plaza Megatón' });
    }

    // 1. CARGA O REINICIALIZACION DE DATOS MAESTROS
    if (action === 'RELOAD_MASTER_DATA') {
      var result = inicializarBaseDeDatos();
      return responseJSON({ success: true, message: 'Catálogo Maestro y Presupuesto inicializados', result: result });
    }

    // 2. SINCRONIZAR USUARIO Y ENVIAR CORREO DE FELICITACIÓN
    if (action === 'SYNC_USUARIO') {
      var sheetUser = ss.getSheetByName('USUARIOS') || obtenerHoja('USUARIOS');
      var sheetUC = ss.getSheetByName('USUARIO_CUBICULO') || obtenerHoja('USUARIO_CUBICULO');
      var sheetCub = ss.getSheetByName('CUBICULOS') || obtenerHoja('CUBICULOS');

      var cubList = Array.isArray(payload.cubiculos) ? payload.cubiculos : [];
      var cubFormattedStr = Array.isArray(payload.cubiculosFormatted) 
        ? payload.cubiculosFormatted.join(', ') 
        : (cubList.map(function(c) {
            if (typeof c === 'object' && c !== null) return c.codigo + (c.nombre ? ' ("' + c.nombre + '")' : '');
            return String(c);
          }).join(', ') || 'Pendiente de asignar');

      sheetUser.appendRow([
        payload.user_id,
        payload.nombre,
        payload.rnc || '',
        payload.email,
        payload.telefono || '',
        payload.tipo || 'Ocupante',
        cubFormattedStr,
        payload.fecha_registro || new Date().toLocaleDateString('es-DO'),
        payload.estado || 'Activo'
      ]);

      cubList.forEach(function(cItem) {
        var cod = typeof cItem === 'object' ? cItem.codigo : String(cItem);
        var nom = typeof cItem === 'object' ? (cItem.nombre || '') : '';
        var act = typeof cItem === 'object' ? (cItem.actividad || '') : '';

        if (cod) {
          sheetUC.appendRow([
            'UC-' + Date.now(),
            payload.user_id,
            '',
            cod,
            nom,
            act,
            '',
            '',
            '',
            new Date().toLocaleDateString('es-DO'),
            'Activo'
          ]);

          if (sheetCub) {
            var cubRows = sheetCub.getDataRange().getValues();
            for (var r = 1; r < cubRows.length; r++) {
              if (String(cubRows[r][1]).toUpperCase() === cod.toUpperCase()) {
                if (nom) sheetCub.getRange(r + 1, 7).setValue(nom);
                if (act) sheetCub.getRange(r + 1, 8).setValue(act);
                sheetCub.getRange(r + 1, 9).setValue('Ocupado');
                sheetCub.getRange(r + 1, 10).setValue(payload.nombre);
                break;
              }
            }
          }
        }
      });

      registrarHistorial('USUARIO', payload.user_id, payload.nombre, 'Registro de nuevo miembro', '', 'Activo', 'Cubículos: ' + cubFormattedStr);

      var portalUrl = payload.portalUrl || DEFAULT_PORTAL_URL;
      enviarCorreoFelicitacion(payload.nombre, payload.email, cubFormattedStr, payload.user_id, portalUrl);

      return responseJSON({ success: true, message: 'Usuario y cubículos registrados con éxito en Google Sheets' });
    }

    // 3. SINCRONIZAR RECLAMACIÓN
    if (action === 'SYNC_RECLAMACION') {
      var sheetRec = ss.getSheetByName('RECLAMACIONES') || obtenerHoja('RECLAMACIONES');
      sheetRec.appendRow([
        payload.codigo,
        payload.fecha,
        payload.hora,
        payload.user_id,
        payload.email,
        payload.cubiculo,
        payload.asunto,
        payload.detalle,
        Array.isArray(payload.archivos) ? payload.archivos.join('; ') : (payload.archivos || ''),
        payload.estado,
        payload.responsable || 'Sin asignar',
        payload.fecha_actualizacion
      ]);

      registrarHistorial('RECLAMACION', payload.codigo, payload.email, 'Nueva Reclamación', '', payload.estado, payload.asunto);
      return responseJSON({ success: true, message: 'Reclamación sincronizada' });
    }

    // 4. SINCRONIZAR PAGO
    if (action === 'SYNC_PAGO') {
      var sheetPag = ss.getSheetByName('PAGOS') || obtenerHoja('PAGOS');
      sheetPag.appendRow([
        payload.codigo,
        payload.fecha_registro,
        payload.user_id,
        payload.email,
        payload.cubiculo,
        payload.concepto,
        payload.periodo,
        payload.monto,
        payload.fecha_pago,
        payload.referencia || '',
        payload.voucher || '',
        payload.estado,
        payload.observaciones || ''
      ]);

      registrarHistorial('PAGO', payload.codigo, payload.email, 'Reporte de Pago', '', payload.estado, payload.concepto + ' - ' + payload.periodo);
      return responseJSON({ success: true, message: 'Pago sincronizado' });
    }

    // 5. TEST DE CONEXIÓN
    if (action === 'TEST_CONNECTION') {
      var rootFolders = DriveApp.getFoldersByName(FOLDER_NAME);
      var folderId = rootFolders.hasNext() ? rootFolders.next().getId() : ROOT_FOLDER_ID;
      return responseJSON({
        success: true,
        message: 'Conexión activa con Google Drive y Google Sheets',
        folderName: FOLDER_NAME,
        folderId: folderId,
        spreadsheetUrl: ss.getUrl()
      });
    }

    return responseJSON({ success: false, error: 'Acción no soportada: ' + action });
  } catch (err) {
    return responseJSON({ success: false, error: err.toString() });
  }
}

function enviarCorreoFelicitacion(nombre, email, cubiculosStr, userId, portalUrl) {
  if (!email || email.indexOf('@') === -1) return;

  var subject = '🎉 ¡Felicitaciones! Te confirmamos como Miembro de Plaza Megatón';
  var htmlBody = 
    '<div style="font-family:\'Segoe UI\',Helvetica,Arial,sans-serif; max-width:600px; margin:0 auto; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:14px; overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,0.06);">' +
      '<div style="background:#D32F2F; padding:24px 20px; text-align:center; color:#FFFFFF;">' +
        '<h1 style="margin:0; font-size:22px; font-weight:900; letter-spacing:1px;">PLAZA MEGATÓN</h1>' +
        '<div style="font-size:12px; margin-top:4px; opacity:0.9; text-transform:uppercase; letter-spacing:0.5px;">Sistema Oficial de Gestión Inmobiliaria</div>' +
      '</div>' +
      '<div style="padding:28px 24px; color:#1E293B;">' +
        '<div style="text-align:center; margin-bottom:20px;">' +
          '<span style="background:#FEE2E2; color:#991B1B; font-weight:800; font-size:11px; padding:4px 12px; border-radius:9999px; text-transform:uppercase; letter-spacing:0.5px;">Confirmación Oficial de Membresía</span>' +
          '<h2 style="font-size:22px; font-weight:900; color:#0F172A; margin:10px 0 4px;">¡Felicitaciones, ' + nombre + '!</h2>' +
          '<p style="font-size:14px; color:#475569; margin:0;">Te confirmamos y felicitamos oficialmente como <strong>Miembro de la Plaza Megatón</strong>.</p>' +
        '</div>' +
        '<div style="background:#FFF5F5; border-left:4px solid #D32F2F; padding:16px; border-radius:8px; margin:20px 0;">' +
          '<div style="font-size:11px; color:#64748B; font-weight:700; text-transform:uppercase;">Código Oficial de Miembro:</div>' +
          '<div style="font-size:20px; font-weight:900; color:#D32F2F; margin-bottom:10px;">' + (userId || 'REGISTRADO') + '</div>' +
          '<div style="font-size:11px; color:#64748B; font-weight:700; text-transform:uppercase;">Cubículo(s) o Local(es) Vinculado(s):</div>' +
          '<div style="font-size:14px; font-weight:800; color:#0F172A;">' + (cubiculosStr || 'Pendiente de asignar') + '</div>' +
        '</div>' +
        '<p style="font-size:14px; line-height:1.6; color:#334155;">' +
          'Tus datos han quedado registrados en nuestra base de datos oficial. Como miembro, tienes acceso permanente a nuestra plataforma web para:' +
        '</p>' +
        '<ul style="font-size:13px; line-height:1.8; color:#334155; padding-left:20px;">' +
          '<li><strong>Reportar solicitudes y reclamaciones:</strong> Con fotos de evidencia y seguimiento en vivo con código <code>CL-xxx</code>.</li>' +
          '<li><strong>Registrar y confirmar pagos:</strong> Subiendo comprobantes bancarios con código oficial <code>PG-xxx</code>.</li>' +
          '<li><strong>Consultas 24/7:</strong> Historial completo de movimientos accesible desde tu teléfono móvil.</li>' +
        '</ul>' +
        '<div style="text-align:center; margin:26px 0;">' +
          '<a href="' + portalUrl + '" target="_blank" style="background:#D32F2F; color:#FFFFFF; text-decoration:none; padding:14px 26px; border-radius:10px; font-weight:800; font-size:14px; display:inline-block; box-shadow:0 4px 12px rgba(211,47,47,0.3);">' +
            '👉 Entrar a la Plataforma Principal de Plaza Megatón' +
          '</a>' +
        '</div>' +
        '<div style="margin-top:24px; padding-top:16px; border-top:1px solid #E2E8F0; font-size:12px; color:#64748B;">' +
          'Atentamente,<br><strong>Consejo de Administración — Plaza Megatón</strong>' +
        '</div>' +
      '</div>' +
    '</div>';

  try {
    MailApp.sendEmail({ to: email, subject: subject, htmlBody: htmlBody });
  } catch (e) {}
}

function registrarHistorial(tipoDoc, codDoc, usuario, accion, ant, nuevo, obs) {
  var ss = getMegatonSpreadsheet();
  if (!ss) return;
  var sheet = ss.getSheetByName('HISTORIAL');
  if (!sheet) return;
  var now = new Date();
  sheet.appendRow([
    'HIST-' + Date.now(),
    tipoDoc,
    codDoc,
    now.toLocaleDateString('es-DO'),
    now.toLocaleTimeString('es-DO'),
    usuario,
    accion,
    ant || '',
    nuevo || '',
    obs || ''
  ]);
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'STATUS';

  if (action === 'INITIALIZE' || action === 'RELOAD') {
    var initResult = inicializarBaseDeDatos();
    return responseJSON({
      success: true,
      message: 'Base de datos inicializada correctamente con Catálogo Maestro y Presupuesto 2026',
      initResult: initResult
    });
  }

  var ss = getMegatonSpreadsheet();
  var rootFolders = DriveApp.getFoldersByName(FOLDER_NAME);
  var folderId = rootFolders.hasNext() ? rootFolders.next().getId() : ROOT_FOLDER_ID;

  return responseJSON({
    status: 'ONLINE',
    plaza: 'PLAZA MEGATON',
    folderDrive: FOLDER_NAME,
    folderId: folderId,
    spreadsheetName: ss ? ss.getName() : DATABASE_NAME,
    spreadsheetId: ss ? ss.getId() : DATABASE_SPREADSHEET_ID,
    tables: ss ? ss.getSheets().map(function(s) { return s.getName(); }) : []
  });
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
