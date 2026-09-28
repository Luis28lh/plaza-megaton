// Script de Validación Integral Automatizada - SISTEMA DE GESTIÓN PLAZA MEGATÓN
const http = require('http');

const PORT = 3007;
const BASE_URL = `http://localhost:${PORT}`;

function makeRequest(path, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    if (body && typeof body === 'object') {
      reqOptions.headers['Content-Type'] = 'application/json';
    }

    const req = http.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (_) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(typeof body === 'object' ? JSON.stringify(body) : body);
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 INICIANDO BATERÍA DE PRUEBAS - PLAZA MEGATÓN');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, testName) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
    }
  }

  try {
    // 1. Catálogo de Cubículos
    const r1 = await makeRequest('/api/catalog/cubiculos');
    assert(r1.status === 200 && r1.data.cubiculos.length >= 30, 'Prueba 1: Catálogo maestro con 30 cubículos inicializado');

    // 2. Registro QR de 1 cubículo
    const r2 = await makeRequest('/api/usuarios/registro', { method: 'POST' }, {
      nombre: 'Juan Pérez',
      email: 'juan.perez@megatest.com',
      telefono: '809-555-1111',
      cubiculos: ['C-001']
    });
    assert(r2.status === 200 && r2.data.success && r2.data.user_id === 'US-001', 'Prueba 2: Registro de ocupante genera código consecutivo US-001');
    assert(r2.data.cubiculosAsignados.includes('C-001'), 'Prueba 2b: Cubículo C-001 asociado correctamente');

    // 3. Registro QR de múltiples cubículos (C-002 y C-003)
    const r3 = await makeRequest('/api/usuarios/registro', { method: 'POST' }, {
      nombre: 'María Gómez',
      email: 'maria.gomez@megatest.com',
      telefono: '809-555-2222',
      cubiculos: ['C-002', 'C-003']
    });
    assert(r3.status === 200 && r3.data.user_id === 'US-002', 'Prueba 3: Segundo usuario genera US-002');
    assert(r3.data.cubiculosAsignados.length === 2, 'Prueba 3b: Múltiples cubículos asociados a un solo usuario');

    // 4. Verificar que cubículos C-001, C-002 y C-003 están en estado Ocupado
    const r4 = await makeRequest('/api/catalog/cubiculos');
    const c1 = r4.data.cubiculos.find(c => c.codigo === 'C-001');
    const c2 = r4.data.cubiculos.find(c => c.codigo === 'C-002');
    assert(c1.estado === 'Ocupado' && c2.estado === 'Ocupado', 'Prueba 4: Estado de cubículos actualizado a "Ocupado"');

    // 5. Crear Reclamación 1 (CL-001)
    const r5 = await makeRequest('/api/reclamaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      nombre: 'Juan Pérez',
      email: 'juan.perez@megatest.com',
      cubiculo: 'C-001',
      asunto: 'Problema eléctrico',
      detalle: 'No enciende la luminaria del pasillo frontal'
    });
    const clNum1 = Number(r5.data.codigo.replace(/\D/g, ''));
    assert(r5.status === 200 && /^CL-\d+$/.test(r5.data.codigo), `Prueba 5: Reclamación genera correlativo ${r5.data.codigo}`);

    // 6. Crear Reclamación 2 (CL-002) - Garantizar consecutividad
    const r6 = await makeRequest('/api/reclamaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      nombre: 'María Gómez',
      email: 'maria.gomez@megatest.com',
      cubiculo: 'C-002',
      asunto: 'Filtración',
      detalle: 'Goteo leve en esquina superior derecha'
    });
    const clNum2 = Number(r6.data.codigo.replace(/\D/g, ''));
    assert(r6.status === 200 && clNum2 === clNum1 + 1, `Prueba 6: Consecutividad estricta garantizada en reclamaciones (${r5.data.codigo} -> ${r6.data.codigo})`);

    // 7. Crear Reporte de Pago 1 (PG-001)
    const r7 = await makeRequest('/api/pagos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      nombre: 'Juan Pérez',
      email: 'juan.perez@megatest.com',
      cubiculo: 'C-001',
      concepto: 'Mantenimiento',
      periodo: 'Septiembre 2026',
      monto: 'RD$5,000.00',
      fecha_pago: '2026-09-22',
      referencia: 'TR-88192'
    });
    const pgNum1 = Number(r7.data.codigo.replace(/\D/g, ''));
    assert(r7.status === 200 && /^PG-\d+$/.test(r7.data.codigo), `Prueba 7: Reporte de pago genera código ${r7.data.codigo}`);

    // 8. Crear Reporte de Pago 2 (PG-002)
    const r8 = await makeRequest('/api/pagos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      nombre: 'María Gómez',
      email: 'maria.gomez@megatest.com',
      cubiculo: 'C-002',
      concepto: 'Alquiler',
      periodo: 'Septiembre 2026',
      monto: 'RD$12,000.00',
      fecha_pago: '2026-09-22',
      referencia: 'TR-88193'
    });
    const pgNum2 = Number(r8.data.codigo.replace(/\D/g, ''));
    assert(r8.status === 200 && pgNum2 === pgNum1 + 1, `Prueba 8: Consecutividad estricta garantizada en pagos (${r7.data.codigo} -> ${r8.data.codigo})`);

    // 9. Dashboard Administrativo (KPIs)
    const r9 = await makeRequest('/api/admin/dashboard', {
      headers: { 'x-admin-pin': 'megaton2026' }
    });
    assert(r9.status === 200 && r9.data.kpis.usuarios.total >= 2, 'Prueba 9: Dashboard Admin refleja usuarios registrados');
    assert(r9.data.kpis.cubiculos.ocupados >= 3, 'Prueba 9b: Dashboard Admin refleja cubículos ocupados');
    assert(r9.data.kpis.reclamaciones.total >= 2, 'Prueba 9c: Dashboard Admin contabiliza reclamaciones');
    assert(r9.data.kpis.pagos.total >= 2, 'Prueba 9d: Dashboard Admin contabiliza pagos');

    // 10. Actualización administrativa de Reclamación con trazabilidad
    const r10 = await makeRequest('/api/reclamaciones/CL-001', {
      method: 'PATCH',
      headers: { 'x-admin-pin': 'megaton2026' }
    }, {
      estado: 'En proceso',
      responsable: 'Técnico Eléctrico Carlos',
      observacion: 'Repuesto en camino para reemplazo'
    });
    assert(r10.status === 200 && r10.data.reclamacion.estado === 'En proceso', 'Prueba 10: Cambio de estado de reclamación a "En proceso"');

    // 11. Conciliación administrativa de Pago
    const r11 = await makeRequest('/api/pagos/PG-001', {
      method: 'PATCH',
      headers: { 'x-admin-pin': 'megaton2026' }
    }, {
      estado: 'Confirmado',
      observaciones: 'Verificado en estado de cuenta bancario'
    });
    assert(r11.status === 200 && r11.data.pago.estado === 'Confirmado', 'Prueba 11: Pago PG-001 marcado como "Confirmado"');

    // 12. Historial de Auditoría
    const r12 = await makeRequest('/api/admin/historial', {
      headers: { 'x-admin-pin': 'megaton2026' }
    });
    assert(r12.status === 200 && r12.data.historial.length >= 6, 'Prueba 12: Tabla HISTORIAL registra auditoría inmutable de cada acción');

    // 13. Seguridad: Bloqueo de acceso al panel admin sin PIN
    const r13 = await makeRequest('/api/admin/dashboard');
    assert(r13.status === 401, 'Prueba 13: Seguridad administrativa bloquea accesos no autorizados (401)');

    // 14. Registro con cubículos apilados, nombre comercial y actividad comercial
    const r14 = await makeRequest('/api/usuarios/registro', { method: 'POST' }, {
      nombre: 'Don Fernando',
      email: 'fernando@megatest.com',
      telefono: '809-555-8899',
      cubiculos: [
        { codigo: 'C10', nombre: 'Taller Alfa', actividad: 'Reparación de celulares' },
        { codigo: 'C11', nombre: 'Boutique Alfa', actividad: 'Venta de ropa' }
      ]
    });
    assert(r14.status === 200 && r14.data.success && r14.data.cubiculosAsignados.length === 2, 'Prueba 14: Registro con cubículos múltiples, nombre y actividad comercial');

    // 15. Verificación de nombre y actividad en catálogo y sesión de usuario
    const r15 = await makeRequest('/api/admin/usuarios', {
      headers: { 'x-admin-pin': 'megaton2026' }
    });
    const uTest = r15.data.usuarios.find(u => u.email === 'fernando@megatest.com');
    const hasCubDetails = uTest && Array.isArray(uTest.cubiculos) && uTest.cubiculos.some(c => c.includes('Taller Alfa') && c.includes('Reparación'));
    assert(hasCubDetails, 'Prueba 15: Datos de nombre local y actividad comercial referenciados correctamente');

    console.log('\n====================================================');
    console.log(`📊 RESULTADO FINAL: ${passed}/${total} PRUEBAS EXITOSAS (${Math.round(passed/total*100)}%)`);
    console.log('====================================================\n');

  } catch (err) {
    console.error('Error ejecutando pruebas:', err);
  }
}

// Si se ejecuta directamente
if (require.main === module) {
  runTests();
}

module.exports = { runTests };
