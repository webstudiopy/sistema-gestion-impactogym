const SUPABASE_URL = 'https://jnumbjykyiohxcdoppzr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Q9fUtf7Wt39Y4Ij2ihAczw_YhFLh7Wb';

const PLANES = {
  Diario: 10000,
  Semanal: 40000,
  Mensual: 130000,
};

const PLAN_DIAS = {
  Diario: 1,
  Semanal: 7,
  Mensual: 30,
};

const toastEl = document.getElementById('appToast');
const toastMsg = document.getElementById('toastMsg');
const appToast = toastEl ? new bootstrap.Toast(toastEl) : null;

const modalConfirmarSalirEl = document.getElementById('modalConfirmarSalir');
const modalSociosVencidosEl = document.getElementById('modalSociosVencidos');

const modalConfirmarSalir = modalConfirmarSalirEl
  ? new bootstrap.Modal(modalConfirmarSalirEl)
  : null;

const state = {
  supabase: null,
  editingSocioId: null,
  socios: [],
  metodos: [],
  pagos: [],
  filtroSocio: '',
};

const $$ = (id) => document.getElementById(id);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function notify(message, isError = false) {
  if (!toastEl || !toastMsg || !appToast) return;
  toastEl.classList.remove('text-bg-danger', 'text-bg-dark');
  toastEl.classList.add(isError ? 'text-bg-danger' : 'text-bg-dark');
  toastMsg.textContent = message;
  appToast.show();
}

function formatGs(value) {
  return `Gs. ${Number(value || 0).toLocaleString('es-PY')}`;
}

function formatGsInput(value) {
  return Number(value || 0).toLocaleString('es-PY');
}

function parseGs(value) {
  return Number(
    String(value || '')
      .replace(/\./g, '')
      .replace(/,/g, '')
      .replace(/\s/g, '')
  ) || 0;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function addDays(dateIso, days) {
  const date = new Date(`${dateIso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function calcDaysFromToday(dateIso) {
  if (!dateIso) return NaN;
  const target = new Date(`${dateIso}T00:00:00`);
  const today = new Date(`${todayISO()}T00:00:00`);
  return Math.round((target - today) / 86400000);
}

function getEstadoBadge(dateIso) {
  const diff = calcDaysFromToday(dateIso);

  if (Number.isNaN(diff)) {
    return '<span class="badge rounded-pill text-bg-secondary">Sin fecha</span>';
  }

  if (diff > 0) {
    return '<span class="badge rounded-pill badge-soft text-bg-success">Al día</span>';
  }

  if (diff === 0) {
    return '<span class="badge rounded-pill badge-soft text-bg-warning">Vence hoy</span>';
  }

  return `<span class="badge rounded-pill badge-overdue">${Math.abs(diff)} día(s) vencido</span>`;
}

function wireMoneyInputs() {
  document.querySelectorAll('.money-input').forEach((input) => {
    input.addEventListener('input', (e) => {
      const raw = parseGs(e.target.value);
      e.target.value = raw ? formatGsInput(raw) : '';
    });
  });
}

function initSupabase() {
  state.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'impactogym-auth',
    },
  });

  console.log('Supabase inicializado en index');
  return true;
}

async function protectPage() {
  try {
    if (window.location.protocol === 'file:') {
      window.location.href = 'login.html';
      return false;
    }

    let { data, error } = await state.supabase.auth.getSession();

    console.log('INDEX SESSION 1:', data?.session);
    console.log('INDEX SESSION ERROR 1:', error);

    if (error) {
      console.error('Error al obtener sesión:', error);
      window.location.href = 'login.html';
      return false;
    }

    if (!data?.session) {
      await sleep(400);

      const secondTry = await state.supabase.auth.getSession();
      data = secondTry.data;
      error = secondTry.error;

      console.log('INDEX SESSION 2:', data?.session);
      console.log('INDEX SESSION ERROR 2:', error);

      if (error) {
        console.error('Error al obtener sesión en segundo intento:', error);
        window.location.href = 'login.html';
        return false;
      }
    }

    if (!data?.session) {
      window.location.href = 'login.html';
      return false;
    }

    const {
      data: { user },
      error: userError,
    } = await state.supabase.auth.getUser();

    console.log('INDEX USER:', user);
    console.log('INDEX USER ERROR:', userError);

    if (userError || !user) {
      console.error('Error al obtener usuario:', userError);
      window.location.href = 'login.html';
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error en protectPage:', error);
    window.location.href = 'login.html';
    return false;
  }
}

function watchAuth() {
  state.supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth event en index:', event, session);

    const eventosQueCierranSesion = [
      'SIGNED_OUT',
      'USER_DELETED',
      'TOKEN_REFRESH_FAILED',
    ];

    if (
      eventosQueCierranSesion.includes(event) &&
      !session &&
      !window.location.pathname.includes('login.html')
    ) {
      window.location.href = 'login.html';
    }
  });
}

function getSociosFiltrados() {
  const filtro = String(state.filtroSocio || '').trim().toLowerCase();

  if (!filtro) return [...state.socios];

  return state.socios.filter((s) => {
    const nombre = String(s.nombre || '').toLowerCase();
    const documento = String(s.documento || '').toLowerCase();
    return nombre.includes(filtro) || documento.includes(filtro);
  });
}

async function fetchSocios() {
  const { data, error } = await state.supabase
    .from('socios')
    .select('*')
    .order('nombre', { ascending: true });

  if (error) throw error;

  state.socios = data || [];
  renderSociosSelect();
  renderSociosTable();
  renderSociosVencidosModal();
}

async function fetchMetodos() {
  const { data, error } = await state.supabase
    .from('formas_pago')
    .select('*')
    .order('nombre', { ascending: true });

  if (error) throw error;

  state.metodos = data || [];
  renderMetodos();
  renderMetodosSelect();
}

async function fetchPagos() {
  const { data, error } = await state.supabase
    .from('pagos')
    .select(`
      id,
      fecha_pago,
      periodo,
      monto,
      observacion,
      socios ( id, nombre ),
      formas_pago ( id, nombre )
    `)
    .order('fecha_pago', { ascending: false })
    .limit(30);

  if (error) throw error;

  state.pagos = data || [];
  renderPagos();
  renderReporteMetodos();
}

function renderSociosSelect() {
  const select = $$('pagoSocio');
  if (!select) return;

  select.innerHTML = '';

  if (!state.socios.length) {
    select.innerHTML = '<option value="">No hay socios</option>';
    return;
  }

  select.innerHTML =
    '<option value="">Seleccionar socio</option>' +
    state.socios
      .map(
        (s) => `
          <option value="${s.id}" data-monto="${s.monto_mensual || 0}" data-plan="${escapeHtml(s.plan || 'Mensual')}">
            ${escapeHtml(s.nombre)}${s.documento ? ` • CI: ${escapeHtml(s.documento)}` : ''}
          </option>
        `
      )
      .join('');
}

function renderSociosTable() {
  const tbody = document.querySelector('#tablaSocios tbody');
  if (!tbody) return;

  const sociosFiltrados = getSociosFiltrados();

  if (!state.socios.length) {
    tbody.innerHTML =
      '<tr><td colspan="7"><div class="empty-state">Todavía no hay socios cargados.</div></td></tr>';
    updateStats();
    return;
  }

  if (!sociosFiltrados.length) {
    tbody.innerHTML =
      '<tr><td colspan="7"><div class="empty-state">No se encontraron socios con ese nombre o CI.</div></td></tr>';
    updateStats();
    return;
  }

  tbody.innerHTML = sociosFiltrados
    .map(
      (s) => `
        <tr>
          <td class="fw-semibold">${escapeHtml(s.documento || '-')}</td>
          <td class="fw-semibold">${escapeHtml(s.nombre)}</td>
          <td>${escapeHtml(s.plan || '-')}</td>
          <td class="text-end fw-bold">${formatGs(s.monto_mensual)}</td>
          <td>${s.proximo_vencimiento || '-'}</td>
          <td>${getEstadoBadge(s.proximo_vencimiento)}</td>
          <td class="text-center">
            <div class="socio-actions-inline">
              <button
                type="button"
                class="icon-btn icon-btn-edit"
                onclick="editSocio('${s.id}')"
                title="Editar"
              >
                <i class="bi bi-pencil-square"></i>
              </button>
              <button
                type="button"
                class="icon-btn icon-btn-delete"
                onclick="deleteSocio('${s.id}')"
                title="Eliminar"
              >
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `
    )
    .join('');

  updateStats();
}

function renderMetodosSelect() {
  const select = $$('pagoMetodo');
  if (!select) return;

  const activos = state.metodos.filter((m) => m.activo);
  select.innerHTML = '';

  if (!activos.length) {
    select.innerHTML = '<option value="">No hay métodos activos</option>';
    return;
  }

  select.innerHTML =
    '<option value="">Seleccionar forma de pago</option>' +
    activos
      .map((m) => `<option value="${m.id}">${escapeHtml(m.nombre)}</option>`)
      .join('');
}

function renderMetodos() {
  const box = $$('listaMetodos');
  if (!box) return;

  if (!state.metodos.length) {
    box.innerHTML = '<div class="empty-state">Aún no cargaste formas de pago.</div>';
    return;
  }

  box.innerHTML = state.metodos
    .map(
      (m) => `
        <div class="method-item">
          <div>
            <div class="method-name">${escapeHtml(m.nombre)}</div>
            <div class="method-meta">Estado: ${m.activo ? 'Activo' : 'Inactivo'}</div>
          </div>
          <div class="d-flex gap-2 flex-wrap justify-content-end">
            <span class="badge ${m.activo ? 'text-bg-success' : 'text-bg-secondary'} badge-soft">
              ${m.activo ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>
      `
    )
    .join('');
}

function renderPagos() {
  const tbody = document.querySelector('#tablaPagos tbody');
  if (!tbody) return;

  if (!state.pagos.length) {
    tbody.innerHTML =
      '<tr><td colspan="6"><div class="empty-state">Todavía no hay pagos cargados.</div></td></tr>';
    updateStats();
    return;
  }

  tbody.innerHTML = state.pagos
    .map(
      (p) => `
        <tr>
          <td>${p.fecha_pago || '-'}</td>
          <td>${escapeHtml(p.socios?.nombre || '-')}</td>
          <td>${p.periodo || '-'}</td>
          <td>${escapeHtml(p.formas_pago?.nombre || '-')}</td>
          <td class="text-end fw-bold">${formatGs(p.monto)}</td>
          <td>${escapeHtml(p.observacion || '-')}</td>
        </tr>
      `
    )
    .join('');

  updateStats();
}

function renderReporteMetodos() {
  const tbody = document.querySelector('#tablaReporteMetodos tbody');
  if (!tbody) return;

  const map = new Map();

  state.pagos.forEach((p) => {
    const key = p.formas_pago?.nombre || 'Sin método';
    const current = map.get(key) || { cantidad: 0, total: 0 };
    current.cantidad += 1;
    current.total += Number(p.monto || 0);
    map.set(key, current);
  });

  const rows = [...map.entries()];

  if (!rows.length) {
    tbody.innerHTML =
      '<tr><td colspan="3"><div class="empty-state">Sin datos para reportar todavía.</div></td></tr>';
    return;
  }

  tbody.innerHTML = rows
    .map(
      ([nombre, data]) => `
        <tr>
          <td class="fw-semibold">${escapeHtml(nombre)}</td>
          <td class="text-end">${data.cantidad}</td>
          <td class="text-end fw-bold">${formatGs(data.total)}</td>
        </tr>
      `
    )
    .join('');
}

function renderSociosVencidosModal() {
  const tbody = $$('tbodySociosVencidos');
  if (!tbody) return;

  const vencidos = state.socios.filter(
    (s) => s.proximo_vencimiento && calcDaysFromToday(s.proximo_vencimiento) < 0
  );

  if (!vencidos.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-secondary py-4">No hay socios vencidos.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = vencidos
    .map(
      (s) => `
        <tr>
          <td class="fw-semibold">${escapeHtml(s.documento || '-')}</td>
          <td class="fw-semibold">${escapeHtml(s.nombre || '-')}</td>
          <td>${escapeHtml(s.plan || '-')}</td>
          <td class="text-end fw-bold">${formatGs(s.monto_mensual || 0)}</td>
          <td>${escapeHtml(s.proximo_vencimiento || '-')}</td>
          <td>${escapeHtml(s.telefono || '-')}</td>
          <td><span class="badge text-bg-danger">Vencido</span></td>
        </tr>
      `
    )
    .join('');
}

function updateStats() {
  const statSocios = $$('statSocios');
  const statIngresos = $$('statIngresos');
  const statPagosHoy = $$('statPagosHoy');
  const statVencidos = $$('statVencidos');
  const statMetodos = $$('statMetodos');
  const kpiSocios = $$('kpiSocios');
  const kpiPagosMes = $$('kpiPagosMes');
  const kpiTotalMes = $$('kpiTotalMes');

  const totalMes = state.pagos
    .filter((p) => String(p.periodo).startsWith(currentMonth()))
    .reduce((acc, p) => acc + Number(p.monto || 0), 0);

  const pagosMes = state.pagos.filter((p) =>
    String(p.periodo).startsWith(currentMonth())
  ).length;

  const pagosHoy = state.pagos
    .filter((p) => String(p.fecha_pago || '') === todayISO())
    .reduce((acc, p) => acc + Number(p.monto || 0), 0);

  const vencidos = state.socios.filter(
    (s) => s.proximo_vencimiento && calcDaysFromToday(s.proximo_vencimiento) < 0
  ).length;

  const metodosActivos = state.metodos.filter((m) => m.activo).length;

  if (statSocios) statSocios.textContent = state.socios.length;
  if (statIngresos) statIngresos.textContent = formatGs(totalMes);
  if (statPagosHoy) statPagosHoy.textContent = formatGs(pagosHoy);
  if (statVencidos) statVencidos.textContent = vencidos;
  if (statMetodos) statMetodos.textContent = metodosActivos;
  if (kpiSocios) kpiSocios.textContent = state.socios.length;
  if (kpiPagosMes) kpiPagosMes.textContent = pagosMes;
  if (kpiTotalMes) kpiTotalMes.textContent = formatGs(totalMes);
}

window.editSocio = (id) => {
  const socio = state.socios.find((s) => String(s.id) === String(id));
  if (!socio) return;

  state.editingSocioId = id;

  $$('socioNombre').value = socio.nombre || '';
  $$('socioDocumento').value = socio.documento || '';
  $$('socioTelefono').value = socio.telefono || '';
  $$('socioPlan').value = socio.plan || 'Mensual';
  $$('socioMonto').value = formatGsInput(socio.monto_mensual || 0);
  $$('socioVencimiento').value = socio.proximo_vencimiento || '';

  const submitBtn = document.querySelector('#formSocio button[type="submit"]');
  if (submitBtn) {
    submitBtn.innerHTML = '<i class="bi bi-check2-circle"></i> Actualizar socio';
  }

  const sociosSection = document.getElementById('socios');
  if (sociosSection) {
    window.scrollTo({
      top: sociosSection.offsetTop - 20,
      behavior: 'smooth',
    });
  }
};

window.deleteSocio = async (id) => {
  const socio = state.socios.find((s) => String(s.id) === String(id));
  if (!socio) return;

  const ok = confirm(`¿Eliminar al socio "${socio.nombre}"?`);
  if (!ok) return;

  try {
    const { error } = await state.supabase
      .from('socios')
      .delete()
      .eq('id', id);

    if (error) throw error;

    if (state.editingSocioId === id) {
      resetSocioForm();
    }

    notify('Socio eliminado correctamente.');
    await fetchSocios();
    await fetchPagos();
  } catch (error) {
    console.error(error);

    if (String(error.message || '').toLowerCase().includes('foreign key')) {
      notify('No se puede eliminar este socio porque tiene pagos relacionados.', true);
      return;
    }

    notify(error.message || 'No se pudo eliminar el socio.', true);
  }
};

function resetSocioForm() {
  state.editingSocioId = null;

  const formSocio = $$('formSocio');
  if (formSocio) formSocio.reset();

  if ($$('socioPlan')) $$('socioPlan').value = 'Mensual';
  setPlanDefaults();

  const submitBtn = document.querySelector('#formSocio button[type="submit"]');
  if (submitBtn) {
    submitBtn.innerHTML = '<i class="bi bi-person-plus-fill"></i> Guardar socio';
  }
}

function setPlanDefaults() {
  const planEl = $$('socioPlan');
  const montoEl = $$('socioMonto');
  const vencEl = $$('socioVencimiento');

  if (!planEl || !montoEl || !vencEl) return;

  const plan = planEl.value;
  montoEl.value = formatGsInput(PLANES[plan] || 0);
  vencEl.value = addDays(todayISO(), PLAN_DIAS[plan] || 30);
}

async function loadAll() {
  try {
    await Promise.all([fetchSocios(), fetchMetodos(), fetchPagos()]);
  } catch (error) {
    console.error(error);
    notify(error.message || 'No se pudo cargar la información.', true);
  }
}

function toggleTheme() {
  const html = document.documentElement;
  html.dataset.bsTheme = html.dataset.bsTheme === 'dark' ? 'light' : 'dark';
}

function openLogoutModal() {
  if (modalConfirmarSalir) {
    modalConfirmarSalir.show();
    return;
  }
  logout();
}

async function logout() {
  try {
    await state.supabase.auth.signOut();
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  } finally {
    window.location.href = 'login.html';
  }
}

function formatFechaLarga(fechaIso) {
  if (!fechaIso) return '-';
  const fecha = new Date(`${fechaIso}T00:00:00`);
  return fecha.toLocaleDateString('es-PY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function obtenerSociosVencidos() {
  return state.socios.filter(
    (s) => s.proximo_vencimiento && calcDaysFromToday(s.proximo_vencimiento) < 0
  );
}

function obtenerPagosMesActual() {
  return state.pagos.filter((p) => String(p.periodo).startsWith(currentMonth()));
}

async function descargarReportePDF() {
  try {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      notify('No se pudo cargar la librería PDF.', true);
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    const sociosActivos = state.socios.length;
    const pagosMes = obtenerPagosMesActual();
    const sociosVencidos = obtenerSociosVencidos();
    const totalMes = pagosMes.reduce((acc, p) => acc + Number(p.monto || 0), 0);

    const reporteMetodos = new Map();
    pagosMes.forEach((p) => {
      const nombreMetodo = p.formas_pago?.nombre || 'Sin método';
      const actual = reporteMetodos.get(nombreMetodo) || { cantidad: 0, total: 0 };
      actual.cantidad += 1;
      actual.total += Number(p.monto || 0);
      reporteMetodos.set(nombreMetodo, actual);
    });

    const fechaEmision = new Date().toLocaleDateString('es-PY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const colores = {
      azulMuyClaro: [235, 243, 255],
      azulSuave: [215, 228, 250],
      azulTexto: [44, 62, 92],
      grisFondo: [248, 250, 252],
      grisCard: [243, 246, 249],
      grisLinea: [220, 226, 235],
      grisTexto: [90, 104, 124],
      verdeSuave: [222, 245, 232],
      verdeTexto: [47, 111, 74],
      rojoSuave: [252, 229, 232],
      rojoTexto: [166, 63, 80],
      celesteSuave: [229, 243, 250],
      oscuro: [32, 46, 66],
    };

    doc.setFillColor(...colores.azulMuyClaro);
    doc.roundedRect(12, 10, 186, 28, 8, 8, 'F');

    doc.setDrawColor(...colores.azulSuave);
    doc.setLineWidth(0.4);
    doc.roundedRect(12, 10, 186, 28, 8, 8);

    doc.setTextColor(...colores.azulTexto);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('Impacto GYM', 18, 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...colores.grisTexto);
    doc.text('Reporte general de cobros', 18, 28);
    doc.text(`Fecha de emisión: ${fechaEmision}`, 190, 21, { align: 'right' });
    doc.text(`Periodo: ${currentMonth()}`, 190, 27, { align: 'right' });

    const cards = [
      { x: 12, titulo: 'SOCIOS ACTIVOS', valor: String(sociosActivos) },
      { x: 76, titulo: 'PAGOS DEL MES', valor: String(pagosMes.length) },
      { x: 140, titulo: 'TOTAL COBRADO', valor: formatGs(totalMes) },
    ];

    cards.forEach((card) => {
      doc.setFillColor(...colores.grisCard);
      doc.roundedRect(card.x, 46, 58, 24, 6, 6, 'F');
      doc.setDrawColor(...colores.grisLinea);
      doc.roundedRect(card.x, 46, 58, 24, 6, 6);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...colores.grisTexto);
      doc.text(card.titulo, card.x + 4, 54);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(...colores.oscuro);
      doc.text(card.valor, card.x + 4, 64);
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...colores.oscuro);
    doc.text('Resumen por forma de pago', 14, 82);

    const resumenMetodosBody = [...reporteMetodos.entries()].map(([nombre, data]) => [
      nombre,
      String(data.cantidad),
      formatGs(data.total),
    ]);

    doc.autoTable({
      startY: 86,
      head: [['Método', 'Cantidad', 'Total']],
      body: resumenMetodosBody.length
        ? resumenMetodosBody
        : [['Sin datos', '-', '-']],
      theme: 'grid',
      headStyles: {
        fillColor: colores.celesteSuave,
        textColor: colores.azulTexto,
        fontStyle: 'bold',
        lineColor: colores.grisLinea,
        lineWidth: 0.2,
      },
      bodyStyles: {
        textColor: colores.oscuro,
        fillColor: [255, 255, 255],
      },
      alternateRowStyles: {
        fillColor: [250, 252, 255],
      },
      styles: {
        fontSize: 9.5,
        cellPadding: 3.2,
        lineColor: colores.grisLinea,
        lineWidth: 0.2,
      },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'right' },
      },
    });

    let nextY = doc.lastAutoTable.finalY + 10;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...colores.oscuro);
    doc.text('Socios vencidos', 14, nextY);

    const vencidosBody = sociosVencidos.map((s) => [
      s.documento || '-',
      s.nombre || '-',
      s.plan || '-',
      formatGs(s.monto_mensual || 0),
      formatFechaLarga(s.proximo_vencimiento),
      s.telefono || '-',
    ]);

    doc.autoTable({
      startY: nextY + 4,
      head: [['CI', 'Socio', 'Plan', 'Monto', 'Vencimiento', 'Teléfono']],
      body: vencidosBody.length
        ? vencidosBody
        : [['-', 'No hay socios vencidos', '-', '-', '-', '-']],
      theme: 'grid',
      headStyles: {
        fillColor: colores.rojoSuave,
        textColor: colores.rojoTexto,
        fontStyle: 'bold',
        lineColor: colores.grisLinea,
        lineWidth: 0.2,
      },
      bodyStyles: {
        textColor: colores.oscuro,
        fillColor: [255, 255, 255],
      },
      alternateRowStyles: {
        fillColor: [255, 250, 251],
      },
      styles: {
        fontSize: 9.2,
        cellPadding: 3.2,
        lineColor: colores.grisLinea,
        lineWidth: 0.2,
      },
      columnStyles: {
        3: { halign: 'right' },
      },
    });

    nextY = doc.lastAutoTable.finalY + 10;

    if (nextY > 240) {
      doc.addPage();
      nextY = 18;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...colores.oscuro);
    doc.text('Últimos pagos registrados', 14, nextY);

    const pagosBody = state.pagos.slice(0, 15).map((p) => [
      formatFechaLarga(p.fecha_pago),
      p.socios?.nombre || '-',
      p.periodo || '-',
      p.formas_pago?.nombre || '-',
      formatGs(p.monto || 0),
    ]);

    doc.autoTable({
      startY: nextY + 4,
      head: [['Fecha', 'Socio', 'Periodo', 'Método', 'Monto']],
      body: pagosBody.length
        ? pagosBody
        : [['Sin pagos', '-', '-', '-', '-']],
      theme: 'grid',
      headStyles: {
        fillColor: colores.verdeSuave,
        textColor: colores.verdeTexto,
        fontStyle: 'bold',
        lineColor: colores.grisLinea,
        lineWidth: 0.2,
      },
      bodyStyles: {
        textColor: colores.oscuro,
        fillColor: [255, 255, 255],
      },
      alternateRowStyles: {
        fillColor: [249, 253, 250],
      },
      styles: {
        fontSize: 9.2,
        cellPadding: 3.2,
        lineColor: colores.grisLinea,
        lineWidth: 0.2,
      },
      columnStyles: {
        4: { halign: 'right' },
      },
    });

    const totalPaginas = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPaginas; i++) {
      doc.setPage(i);
      doc.setDrawColor(...colores.grisLinea);
      doc.line(14, 286, 196, 286);

      doc.setFontSize(8.5);
      doc.setTextColor(...colores.grisTexto);
      doc.text(
        `Impacto GYM • Reporte generado automáticamente`,
        14,
        290
      );
      doc.text(
        `Página ${i} de ${totalPaginas}`,
        196,
        290,
        { align: 'right' }
      );
    }

    doc.save(`impacto-gym-reporte-${currentMonth()}.pdf`);
    notify('PDF generado correctamente.');
  } catch (error) {
    console.error(error);
    notify('No se pudo generar el PDF.', true);
  }
}

function setupMenuLinks() {
  const allLinks = document.querySelectorAll('.nav-link[data-target]');

  allLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();

      const targetId = link.getAttribute('data-target');
      const section = document.getElementById(targetId);
      if (!section) return;

      const mobileMenu = document.getElementById('mobileMenu');
      const offcanvasVisible = mobileMenu && mobileMenu.classList.contains('show');

      if (offcanvasVisible) {
        const offcanvasInstance = bootstrap.Offcanvas.getOrCreateInstance(mobileMenu);
        offcanvasInstance.hide();

        setTimeout(() => {
          const top = section.getBoundingClientRect().top + window.scrollY - 16;
          window.scrollTo({
            top,
            behavior: 'smooth',
          });
        }, 250);
      } else {
        const top = section.getBoundingClientRect().top + window.scrollY - 16;
        window.scrollTo({
          top,
          behavior: 'smooth',
        });
      }
    });
  });
}

function setupBuscarSocio() {
  const input = $$('buscarSocio');
  if (!input) return;

  input.addEventListener('input', (e) => {
    state.filtroSocio = e.target.value || '';
    renderSociosTable();
  });
}

if ($$('formSocio')) {
  $$('formSocio').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!state.supabase) {
      notify('No se pudo conectar con Supabase.', true);
      return;
    }

    const isEditing = Boolean(state.editingSocioId);

    try {
      const payload = {
        nombre: $$('socioNombre').value.trim(),
        documento: $$('socioDocumento').value.trim() || null,
        telefono: $$('socioTelefono').value.trim() || null,
        plan: $$('socioPlan').value,
        monto_mensual: parseGs($$('socioMonto').value),
        proximo_vencimiento: $$('socioVencimiento').value,
        activo: true,
      };

      let result;

      if (isEditing) {
        result = await state.supabase
          .from('socios')
          .update(payload)
          .eq('id', state.editingSocioId);
      } else {
        result = await state.supabase
          .from('socios')
          .insert(payload);
      }

      if (result.error) throw result.error;

      resetSocioForm();
      notify(isEditing ? 'Socio actualizado correctamente.' : 'Socio guardado correctamente.');
      await fetchSocios();
      await fetchPagos();
    } catch (error) {
      console.error(error);
      notify(error.message || 'No se pudo guardar el socio.', true);
    }
  });
}

if ($$('pagoSocio')) {
  $$('pagoSocio').addEventListener('change', () => {
    const selected = $$('pagoSocio').selectedOptions[0];
    if (!selected) return;

    const monto = Number(selected.dataset.monto || 0);
    if (monto && $$('pagoMonto')) {
      $$('pagoMonto').value = formatGsInput(monto);
    }
  });
}

if ($$('socioPlan')) {
  $$('socioPlan').addEventListener('change', setPlanDefaults);
}

if ($$('formPago')) {
  $$('formPago').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!state.supabase) {
      notify('No se pudo conectar con Supabase.', true);
      return;
    }

    try {
      const socioId = $$('pagoSocio').value;
      const fechaPago = $$('pagoFecha').value;
      const socio = state.socios.find((s) => String(s.id) === String(socioId));

      const payload = {
        socio_id: socioId,
        forma_pago_id: $$('pagoMetodo').value,
        monto: parseGs($$('pagoMonto').value),
        periodo: $$('pagoPeriodo').value,
        fecha_pago: fechaPago,
        observacion: $$('pagoObservacion').value.trim() || null,
      };

      const { error } = await state.supabase.from('pagos').insert(payload);
      if (error) throw error;

      if (socio) {
        const nuevoVencimiento = addDays(fechaPago, PLAN_DIAS[socio.plan] || 30);

        const updateRes = await state.supabase
          .from('socios')
          .update({ proximo_vencimiento: nuevoVencimiento })
          .eq('id', socio.id);

        if (updateRes.error) throw updateRes.error;
      }

      e.target.reset();
      if ($$('pagoFecha')) $$('pagoFecha').value = todayISO();
      if ($$('pagoPeriodo')) $$('pagoPeriodo').value = currentMonth();
      notify('Pago registrado correctamente.');
      await loadAll();
    } catch (error) {
      console.error(error);
      notify(error.message || 'No se pudo registrar el pago.', true);
    }
  });
}

if ($$('btnLogout')) {
  $$('btnLogout').addEventListener('click', openLogoutModal);
}

if ($$('btnLogoutMobile')) {
  $$('btnLogoutMobile').addEventListener('click', openLogoutModal);
}

if ($$('btnConfirmarSalir')) {
  $$('btnConfirmarSalir').addEventListener('click', logout);
}

if ($$('btnTheme')) {
  $$('btnTheme').addEventListener('click', toggleTheme);
}

if ($$('btnThemeMobile')) {
  $$('btnThemeMobile').addEventListener('click', toggleTheme);
}

if ($$('btnDescargarPDF')) {
  $$('btnDescargarPDF').addEventListener('click', descargarReportePDF);
}

if ($$('btnDescargarPDFMobile')) {
  $$('btnDescargarPDFMobile').addEventListener('click', descargarReportePDF);
}

if (modalSociosVencidosEl) {
  modalSociosVencidosEl.addEventListener('show.bs.modal', renderSociosVencidosModal);
}

if ($$('formSocio')) {
  const resetBtnSocio = document.querySelector('#formSocio button[type="reset"]');
  if (resetBtnSocio) {
    resetBtnSocio.addEventListener('click', () => {
      setTimeout(() => {
        resetSocioForm();
      }, 0);
    });
  }
}

function setDefaults() {
  if ($$('pagoFecha')) $$('pagoFecha').value = todayISO();
  if ($$('pagoPeriodo')) $$('pagoPeriodo').value = currentMonth();
  if ($$('socioPlan')) $$('socioPlan').value = 'Mensual';
  if ($$('socioPlan')) setPlanDefaults();
}

wireMoneyInputs();
setDefaults();
setupBuscarSocio();

(async () => {
  if (initSupabase()) {
    const ok = await protectPage();
    if (ok) {
      watchAuth();
      await loadAll();
      setupMenuLinks();
    }
  }
})();