/**
 * SISTEMA DE GESTIÓN – PLAZA MEGATÓN
 * Google Apps Script v2.1 — Base de Datos en Google Drive y Google Sheets
 * 
 * Funcionalidades automáticas:
 * 1. Carpeta raíz en Google Drive: "PLAZA MEGATÓN"
 * 2. Base de datos centralizada: "PLAZA_MEGATON_DATABASE"
 * 3. Subcarpetas organizadas para evidencias y comprobantes:
 *    - "01 - RECLAMACIONES"
 *    - "02 - PAGOS"
 *    - "03 - COPIAS DE SEGURIDAD"
 * 4. Pestañas / Tablas estructuradas con formato corporativo rojo (#D32F2F).
 * 5. Envío automático de correo de felicitación y confirmación como miembro
 *    de Plaza Megatón con enlace directo a la plataforma principal.
 * 6. Conexión bidireccional mediante Webhook HTTP GET y POST para sincronización
 *    en tiempo real desde el servidor local y GitHub Pages.
 */

var FOLDER_NAME = 'PLAZA MEGATÓN';
var DATABASE_NAME = 'PLAZA_MEGATON_DATABASE';
var DATABASE_SPREADSHEET_ID = '1_pHnJkeyVTbVfXacVOFIsKDYb3vaP-EBepc3tm3CQKY';
var ROOT_FOLDER_ID = '1CUUpP7K2roI8cemURppsB5QyPm6WAgpY';
var DEFAULT_PORTAL_URL = 'https://luis28lh.github.io/plaza-megaton/index.html';

/**
 * Obtiene la referencia a la hoja de cálculo de Plaza Megatón
 */
function getMegatonSpreadsheet() {
  var ss = null;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch(e) {}
  if (!ss && typeof DATABASE_SPREADSHEET_ID !== 'undefined' && DATABASE_SPREADSHEET_ID) {
    try {
      ss = SpreadsheetApp.openById(DATABASE_SPREADSHEET_ID);
    } catch(e) {}
  }
  if (!ss) {
    try {
      var files = DriveApp.getFilesByName(DATABASE_NAME);
      if (files.hasNext()) {
        ss = SpreadsheetApp.open(files.next());
      }
    } catch(e) {}
  }
  return ss;
}

/**
 * Inicializa la carpeta en Google Drive, la base de datos y todas las tablas
 */
function inicializarBaseDeDatos() {
  var ss = getMegatonSpreadsheet();
  if (!ss) {
    throw new Error('No se pudo encontrar o abrir la hoja de cálculo ' + DATABASE_NAME);
  }

  // 1. Obtener o crear la carpeta "PLAZA MEGATÓN" en Google Drive
  var rootFolder = null;
  if (typeof ROOT_FOLDER_ID !== 'undefined' && ROOT_FOLDER_ID) {
    try {
      rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
    } catch(e) {}
  }
  if (!rootFolder) {
    rootFolder = obtenerOCrearCarpetaDrive(FOLDER_NAME);
  }

  // 2. Mover la hoja de cálculo a la carpeta "PLAZA MEGATÓN" si no está dentro
  moverArchivoAFolder(ss.getId(), rootFolder);

  // 3. Crear subcarpetas organizadas en Google Drive
  obtenerOCrearSubcarpeta(rootFolder, '01 - RECLAMACIONES');
  obtenerOCrearSubcarpeta(rootFolder, '02 - PAGOS');
  obtenerOCrearSubcarpeta(rootFolder, '03 - COPIAS DE SEGURIDAD');

  // 4. Estructura de tablas y cabeceras
  var pestañasRequeridas = [
    {
      nombre: 'USUARIOS',
      cabeceras: ['user_id', 'nombre', 'email', 'telefono', 'cubiculos_asociados', 'fecha_registro', 'estado']
    },
    {
      nombre: 'CUBICULOS',
      cabeceras: ['cubiculo_id', 'codigo', 'nombre_local', 'actividad_comercial', 'estado', 'observaciones']
    },
    {
      nombre: 'USUARIO_CUBICULO',
      cabeceras: ['id', 'user_id', 'cubiculo_id', 'nombre_local', 'actividad_comercial', 'fecha_asignacion', 'estado']
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

  pestañasRequeridas.forEach(function(item) {
    var sheet = ss.getSheetByName(item.nombre);
    if (!sheet) {
      sheet = ss.insertSheet(item.nombre);
      sheet.appendRow(item.cabeceras);
      sheet.getRange(1, 1, 1, item.cabeceras.length)
        .setFontWeight('bold')
        .setBackground('#D32F2F')
        .setFontColor('#FFFFFF')
        .setHorizontalAlignment('center');
      sheet.setFrozenRows(1);
    }
  });

  // 5. Precargar catálogo de cubículos si la pestaña CUBICULOS está vacía
  var sheetCub = ss.getSheetByName('CUBICULOS');
  if (sheetCub && sheetCub.getLastRow() <= 1) {
    var cubData = [];
    for (var i = 1; i <= 30; i++) {
      var cod = 'C-' + (i < 10 ? '00' + i : (i < 100 ? '0' + i : i));
      cubData.push(['CUB-' + (i < 10 ? '00' + i : i), cod, '', '', 'Disponible', 'Nivel 1']);
    }
    sheetCub.getRange(2, 1, cubData.length, 6).setValues(cubData);
  }

  // 6. Eliminar la "Hoja 1" por defecto si existe y tenemos las otras
  var defaultSheet = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch (_) {}
  }

  Logger.log('========================================================');
  Logger.log('¡Base de Datos Plaza Megatón configurada con éxito!');
  Logger.log('Carpeta en Google Drive: ' + rootFolder.getName() + ' (ID: ' + rootFolder.getId() + ')');
  Logger.log('Spreadsheet: ' + ss.getName() + ' (URL: ' + ss.getUrl() + ')');
  Logger.log('========================================================');

  return {
    success: true,
    folderId: rootFolder.getId(),
    spreadsheetId: ss.getId(),
    tables: ss.getSheets().map(function(s) { return s.getName(); })
  };
}

/**
 * Auxiliar: Busca o crea una carpeta en la raíz de Google Drive
 */
function obtenerOCrearCarpetaDrive(nombre) {
  var folders = DriveApp.getFoldersByName(nombre);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(nombre);
}

/**
 * Auxiliar: Busca o crea una subcarpeta dentro de una carpeta padre
 */
function obtenerOCrearSubcarpeta(parentFolder, nombre) {
  var subFolders = parentFolder.getFoldersByName(nombre);
  return subFolders.hasNext() ? subFolders.next() : parentFolder.createFolder(nombre);
}

/**
 * Auxiliar: Mueve un archivo a una carpeta específica
 */
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
        if (op.getId() !== targetFolder.getId()) {
          op.removeFile(file);
        }
      }
    }
  } catch(e) {
    Logger.log('Aviso al mover archivo a carpeta: ' + e.toString());
  }
}

/**
 * Auxiliar: Retorna o inicializa una hoja por nombre
 */
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

    // 1. SINCRONIZAR USUARIO Y ENVIAR CORREO DE FELICITACIÓN
    if (action === 'SYNC_USUARIO') {
      var sheetUser = ss.getSheetByName('USUARIOS') || obtenerHoja('USUARIOS');
      var sheetUC = ss.getSheetByName('USUARIO_CUBICULO') || obtenerHoja('USUARIO_CUBICULO');
      var sheetCub = ss.getSheetByName('CUBICULOS') || obtenerHoja('CUBICULOS');

      var cubList = Array.isArray(payload.cubiculos) ? payload.cubiculos : [];
      var cubFormattedStr = Array.isArray(payload.cubiculosFormatted) 
        ? payload.cubiculosFormatted.join(', ') 
        : (cubList.map(function(c) {
            if (typeof c === 'object' && c !== null) {
              return c.codigo + (c.nombre ? ' ("' + c.nombre + '")' : '');
            }
            return String(c);
          }).join(', ') || 'Pendiente de asignar');

      // Agregar fila de usuario
      sheetUser.appendRow([
        payload.user_id,
        payload.nombre,
        payload.email,
        payload.telefono || '',
        cubFormattedStr,
        payload.fecha_registro || new Date().toLocaleDateString('es-DO'),
        payload.estado || 'Activo'
      ]);

      // Asociar cubículos
      cubList.forEach(function(cItem) {
        var cod = typeof cItem === 'object' ? cItem.codigo : String(cItem);
        var nom = typeof cItem === 'object' ? (cItem.nombre || '') : '';
        var act = typeof cItem === 'object' ? (cItem.actividad || '') : '';

        if (cod) {
          sheetUC.appendRow([
            'UC-' + Date.now(),
            payload.user_id,
            cod,
            nom,
            act,
            new Date().toLocaleDateString('es-DO'),
            'Activo'
          ]);

          // Actualizar estado en catálogo de CUBICULOS
          if (sheetCub) {
            var cubRows = sheetCub.getDataRange().getValues();
            for (var r = 1; r < cubRows.length; r++) {
              if (String(cubRows[r][1]).toUpperCase() === cod.toUpperCase()) {
                if (nom) sheetCub.getRange(r + 1, 3).setValue(nom);
                if (act) sheetCub.getRange(r + 1, 4).setValue(act);
                sheetCub.getRange(r + 1, 5).setValue('Ocupado');
                break;
              }
            }
          }
        }
      });

      // Registrar en HISTORIAL
      registrarHistorial('USUARIO', payload.user_id, payload.nombre, 'Registro de nuevo miembro', '', 'Activo', 'Cubículos: ' + cubFormattedStr);

      // ENVIAR CORREO DE FELICITACIÓN Y CONFIRMACIÓN DE MEMBRESÍA
      var portalUrl = payload.portalUrl || DEFAULT_PORTAL_URL;
      enviarCorreoFelicitacion(payload.nombre, payload.email, cubFormattedStr, payload.user_id, portalUrl);

      return responseJSON({ success: true, message: 'Usuario y cubículos registrados con éxito en Google Sheets' });
    }

    // 2. SINCRONIZAR RECLAMACIÓN
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

    // 3. SINCRONIZAR PAGO
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

    // 4. TEST DE CONEXIÓN
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

/**
 * Función oficial de despacho de correo de felicitación y confirmación
 */
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
          'Tus datos han quedado registrados en nuestra base de datos. Como miembro oficial, tienes acceso permanente a nuestra plataforma web para:' +
        '</p>' +
        '<ul style="font-size:13px; line-height:1.8; color:#334155; padding-left:20px;">' +
          '<li><strong>Reportar solicitudes y reclamaciones:</strong> Con fotos de evidencia y seguimiento en vivo con código <code>CL-xxx</code>.</li>' +
          '<li><strong>Registrar y confirmar pagos:</strong> Subiendo comprobantes o vouchers bancarios con código oficial <code>PG-xxx</code>.</li>' +
          '<li><strong>Consultas 24/7:</strong> Historial completo de movimientos accesible desde tu teléfono móvil.</li>' +
        '</ul>' +
        '<p style="font-size:14px; color:#334155; margin-top:18px;">' +
          '¡Enhorabuena por ser parte fundamental de la comunidad de Plaza Megatón! Puedes acceder a la plataforma principal en cualquier momento desde el siguiente enlace:' +
        '</p>' +
        '<div style="text-align:center; margin:26px 0;">' +
          '<a href="' + portalUrl + '" target="_blank" style="background:#D32F2F; color:#FFFFFF; text-decoration:none; padding:14px 26px; border-radius:10px; font-weight:800; font-size:14px; display:inline-block; box-shadow:0 4px 12px rgba(211,47,47,0.3);">' +
            '👉 Entrar a la Plataforma Principal de Plaza Megatón' +
          '</a>' +
          '<div style="margin-top:8px; font-size:11px; color:#64748B;">' +
            'Enlace directo: <a href="' + portalUrl + '" style="color:#D32F2F; word-break:break-all;">' + portalUrl + '</a>' +
          '</div>' +
        '</div>' +
        '<div style="margin-top:24px; padding-top:16px; border-top:1px solid #E2E8F0; font-size:12px; color:#64748B;">' +
          'Atentamente,<br><strong>Consejo de Administración — Plaza Megatón</strong>' +
        '</div>' +
      '</div>' +
    '</div>';

  try {
    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: htmlBody
    });
  } catch (e) {
    Logger.log('Error enviando correo de bienvenida: ' + e.toString());
  }
}

/**
 * Auxiliar: Registra en la pestaña HISTORIAL
 */
function registrarHistorial(tipoDoc, codDoc, usuario, accion, ant, nuevo, obs) {
  var ss = getMegatonSpreadsheet();
  if (!ss) return;
  var sheet = ss.getSheetByName('HISTORIAL');
  if (!sheet) return;
  var now = new Date();
  var fecha = now.toLocaleDateString('es-DO');
  var hora = now.toLocaleTimeString('es-DO');
  sheet.appendRow([
    'HIST-' + Date.now(),
    tipoDoc,
    codDoc,
    fecha,
    hora,
    usuario,
    accion,
    ant || '',
    nuevo || '',
    obs || ''
  ]);
}

/**
 * Endpoint GET para comprobar estado o inicializar tablas
 */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'STATUS';

  if (action === 'INITIALIZE') {
    var initResult = inicializarBaseDeDatos();
    return responseJSON({
      success: true,
      message: 'Base de datos inicializada correctamente en Google Drive',
      initResult: initResult
    });
  }

  var ss = getMegatonSpreadsheet();
  var rootFolders = DriveApp.getFoldersByName(FOLDER_NAME);
  var folderId = rootFolders.hasNext() ? rootFolders.next().getId() : ROOT_FOLDER_ID;

  return responseJSON({
    status: 'ONLINE',
    plaza: 'PLAZA MEGATÓN',
    folderDrive: FOLDER_NAME,
    folderId: folderId,
    spreadsheetName: ss ? ss.getName() : DATABASE_NAME,
    spreadsheetId: ss ? ss.getId() : DATABASE_SPREADSHEET_ID,
    tables: ss ? ss.getSheets().map(function(s) { return s.getName(); }) : []
  });
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
