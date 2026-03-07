const SUPABASE_URL = 'https://jnumbjykyiohxcdoppzr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Q9fUtf7Wt39Y4Ij2ihAczw_YhFLh7Wb'

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
const appToast = new bootstrap.Toast(toastEl);

const state = {
  supabase: null,
  editingMethodId: null,
  socios: [],
  metodos: [],
  pagos: [],
};

const $$ = (id) => document.getElementById(id);

async function protectPage() {
  const { data, error } = await state.supabase.auth.getSession();

  if (error || !data?.session) {
    window.location.href = 'login.html';
    return false;
  }

  return true;
}

function notify(message, isError = false) {
  toastEl.classList.toggle('text-bg-danger', isError);
  toastEl.classList.toggle('text-bg-dark', !isError);
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
  return Number(String(value || '').replace(/\./g, '').replace(/,/g, '').replace(/\s/g, '')) || 0;
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
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function calcDaysFromToday(dateIso) {
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
    return `<span class="badge rounded-pill badge-soft text-bg-success">Al día</span>`;
  }
  if (diff === 0) {
    return `<span class="badge rounded-pill badge-soft text-bg-warning">Vence hoy</span>`;
  }
  return `<span class="badge rounded-pill badge-overdue">${diff}</span>`;
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
  if (
    !SUPABASE_URL || !SUPABASE_ANON_KEY ||
    SUPABASE_URL.includes('PEGAR_AQUI') ||
    SUPABASE_ANON_KEY.includes('PEGAR_AQUI')
  ) {
    notify('Edita js/app.js y pega tu URL y anon key de Supabase.', true);
    return false;
  }

  state.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return true;
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
  select.innerHTML = '';
  if (!state.socios.length) {
    select.innerHTML = '<option value="">No hay socios</option>';
    return;
  }
  select.innerHTML = '<option value="">Seleccionar socio</option>' + state.socios
    .map((s) => `<option value="${s.id}" data-monto="${s.monto_mensual || 0}" data-plan="${escapeHtml(s.plan || 'Mensual')}">${escapeHtml(s.nombre)}</option>`)
    .join('');
}

function renderSociosTable() {
  const tbody = document.querySelector('#tablaSocios tbody');
  if (!state.socios.length) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state">Todavía no hay socios cargados.</div></td></tr>';
    updateStats();
    return;
  }

  tbody.innerHTML = state.socios.map((s) => `
    <tr>
      <td class="fw-semibold">${escapeHtml(s.nombre)}</td>
      <td>${escapeHtml(s.plan || '-')}</td>
      <td class="text-end fw-bold">${formatGs(s.monto_mensual)}</td>
      <td>${s.proximo_vencimiento || '-'}</td>
      <td>${getEstadoBadge(s.proximo_vencimiento)}</td>
    </tr>
  `).join('');

  updateStats();
}

function renderMetodosSelect() {
  const select = $$('pagoMetodo');
  const activos = state.metodos.filter((m) => m.activo);
  select.innerHTML = '';
  if (!activos.length) {
    select.innerHTML = '<option value="">No hay métodos activos</option>';
    return;
  }
  select.innerHTML = '<option value="">Seleccionar forma de pago</option>' + activos
    .map((m) => `<option value="${m.id}">${escapeHtml(m.nombre)}</option>`)
    .join('');
}

function renderMetodos() {
  const box = $$('listaMetodos');
  if (!state.metodos.length) {
    box.innerHTML = '<div class="empty-state">Aún no cargaste formas de pago.</div>';
    return;
  }

  box.innerHTML = state.metodos.map((m) => `
    <div class="method-item">
      <div>
        <div class="method-name">${escapeHtml(m.nombre)}</div>
        <div class="method-meta">Estado: ${m.activo ? 'Activo' : 'Inactivo'}</div>
      </div>
      <div class="d-flex gap-2 flex-wrap justify-content-end">
        <span class="badge ${m.activo ? 'text-bg-success' : 'text-bg-secondary'} badge-soft">${m.activo ? 'Activo' : 'Inactivo'}</span>
        <button class="btn btn-outline-primary btn-sm" onclick="startEditMethod('${m.id}', '${escapeHtml(m.nombre)}', ${m.activo})">
          <i class="bi bi-pencil-square"></i>
        </button>
      </div>
    </div>
  `).join('');
}

function renderPagos() {
  const tbody = document.querySelector('#tablaPagos tbody');
  if (!state.pagos.length) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state">Todavía no hay pagos cargados.</div></td></tr>';
    updateStats();
    return;
  }

  tbody.innerHTML = state.pagos.map((p) => `
    <tr>
      <td>${p.fecha_pago || '-'}</td>
      <td>${escapeHtml(p.socios?.nombre || '-')}</td>
      <td>${p.periodo || '-'}</td>
      <td>${escapeHtml(p.formas_pago?.nombre || '-')}</td>
      <td class="text-end fw-bold">${formatGs(p.monto)}</td>
      <td>${escapeHtml(p.observacion || '-')}</td>
    </tr>
  `).join('');
  updateStats();
}

function renderReporteMetodos() {
  const tbody = document.querySelector('#tablaReporteMetodos tbody');
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
    tbody.innerHTML = '<tr><td colspan="3"><div class="empty-state">Sin datos para reportar todavía.</div></td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(([nombre, data]) => `
    <tr>
      <td class="fw-semibold">${escapeHtml(nombre)}</td>
      <td class="text-end">${data.cantidad}</td>
      <td class="text-end fw-bold">${formatGs(data.total)}</td>
    </tr>
  `).join('');
}

function updateStats() {
  const totalMes = state.pagos
    .filter((p) => String(p.periodo).startsWith(currentMonth()))
    .reduce((acc, p) => acc + Number(p.monto || 0), 0);

  const pagosMes = state.pagos.filter((p) => String(p.periodo).startsWith(currentMonth())).length;
  const vencidos = state.socios.filter((s) => s.proximo_vencimiento && calcDaysFromToday(s.proximo_vencimiento) < 0).length;
  const metodosActivos = state.metodos.filter((m) => m.activo).length;

  $$('statSocios').textContent = state.socios.length;
  $$('statIngresos').textContent = formatGs(totalMes);
  $$('statVencidos').textContent = vencidos;
  $$('statMetodos').textContent = metodosActivos;
  $$('kpiSocios').textContent = state.socios.length;
  $$('kpiPagosMes').textContent = pagosMes;
  $$('kpiTotalMes').textContent = formatGs(totalMes);
}

window.startEditMethod = (id, name, active) => {
  state.editingMethodId = id;
  $$('metodoNombre').value = name;
  $$('metodoActivo').value = String(active);
  $$('btnCancelarEdicion').hidden = false;
  window.scrollTo({ top: document.getElementById('metodos').offsetTop - 20, behavior: 'smooth' });
};

function resetMethodForm() {
  state.editingMethodId = null;
  $$('formMetodo').reset();
  $$('metodoActivo').value = 'true';
  $$('btnCancelarEdicion').hidden = true;
}

function setPlanDefaults() {
  const plan = $$('socioPlan').value;
  $$('socioMonto').value = formatGsInput(PLANES[plan] || 0);
  $$('socioVencimiento').value = addDays(todayISO(), PLAN_DIAS[plan] || 30);
}

async function loadAll() {
  try {
    await Promise.all([fetchSocios(), fetchMetodos(), fetchPagos()]);
  } catch (error) {
    console.error(error);
    notify(error.message || 'No se pudo cargar la información.', true);
  }
}

$$('formSocio').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.supabase) return notify('No se pudo conectar con Supabase.', true);

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

    const { error } = await state.supabase.from('socios').insert(payload);
    if (error) throw error;
    e.target.reset();
    setPlanDefaults();
    notify('Socio guardado correctamente.');
    await fetchSocios();
  } catch (error) {
    console.error(error);
    notify(error.message || 'No se pudo guardar el socio.', true);
  }
});

$$('pagoSocio').addEventListener('change', () => {
  const selected = $$('pagoSocio').selectedOptions[0];
  if (!selected) return;
  const monto = Number(selected.dataset.monto || 0);
  if (monto) $$('pagoMonto').value = formatGsInput(monto);
});

$$('socioPlan').addEventListener('change', setPlanDefaults);

$$('formPago').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.supabase) return notify('No se pudo conectar con Supabase.', true);

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
    $$('pagoFecha').value = todayISO();
    $$('pagoPeriodo').value = currentMonth();
    notify('Pago registrado correctamente.');
    await loadAll();
  } catch (error) {
    console.error(error);
    notify(error.message || 'No se pudo registrar el pago.', true);
  }
});

$$('formMetodo').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.supabase) return notify('No se pudo conectar con Supabase.', true);

  try {
    const payload = {
      nombre: $$('metodoNombre').value.trim(),
      activo: $$('metodoActivo').value === 'true',
    };

    let result;
    const isEditing = Boolean(state.editingMethodId);
    if (isEditing) {
      result = await state.supabase.from('formas_pago').update(payload).eq('id', state.editingMethodId);
    } else {
      result = await state.supabase.from('formas_pago').insert(payload);
    }

    if (result.error) throw result.error;
    resetMethodForm();
    notify(isEditing ? 'Método actualizado.' : 'Método guardado.');
    await fetchMetodos();
  } catch (error) {
    console.error(error);
    notify(error.message || 'No se pudo guardar el método.', true);
  }
});
if ($$('btnLogout')) {
  $$('btnLogout').addEventListener('click', logout);
}
$$('btnCancelarEdicion').addEventListener('click', resetMethodForm);
$$('btnRecargar').addEventListener('click', loadAll);
$$('btnTheme').addEventListener('click', () => {
  const html = document.documentElement;
  html.dataset.bsTheme = html.dataset.bsTheme === 'dark' ? 'light' : 'dark';
});

function setDefaults() {
  $$('pagoFecha').value = todayISO();
  $$('pagoPeriodo').value = currentMonth();
  $$('metodoActivo').value = 'true';
  $$('socioPlan').value = 'Mensual';
  setPlanDefaults();
}

async function logout() {
  await state.supabase.auth.signOut();
  window.location.href = 'login.html';
}

wireMoneyInputs();
setDefaults();

(async () => {
  if (initSupabase()) {
    const ok = await protectPage();
    if (ok) {
      loadAll();
    }
  }
})();
