document.addEventListener('DOMContentLoaded', function () {
	// ===================================================================================
	// CONFIGURACIÓN API
	// ===================================================================================
	const API_BASE_URL = window.location.origin + '/api';
	let authToken = localStorage.getItem('authToken');

	// ===================================================================================
	// ESTADO GLOBAL
	// ===================================================================================
	let state = {
		currentUser: null,
		currentExpenses: [],
		viaticosBalance: [],
		selectedViatico: null,
		currentMaintenanceEntity: 'users',
		apiData: {
			users: [],
			clients: [],
			branches: [],
			expenseTypes: [],
		},
	};

	// ===================================================================================
	// ELEMENTOS DOM
	// ===================================================================================
	const loginScreen = document.getElementById('login-screen');
	const appScreen = document.getElementById('app-screen');
	const loginForm = document.getElementById('login-form');
	const usernameInput = document.getElementById('username');
	const passwordInput = document.getElementById('password');
	const loginError = document.getElementById('login-error');
	const userInfo = document.getElementById('user-info');
	const logoutBtn = document.getElementById('logout-btn');
	const maintenanceTabBtn = document.getElementById('maintenance-tab-btn');

	// Formulario
	const empleadoSelect = document.getElementById('empleado');
	const cuentaSelect = document.getElementById('cuenta');
	const clienteSelect = document.getElementById('cliente');
	const sucursalSelect = document.getElementById('sucursal');
	const numeroCuentaInput = document.getElementById('numero-cuenta');
	const importeInput = document.getElementById('importe-sin-itbis');
	const itbisInput = document.getElementById('itbis');
	const totalGastoInput = document.getElementById('total-gasto');
	const addGastoBtn = document.getElementById('add-gasto-btn');
	const expensesContainer = document.getElementById('expenses-container');
	const summarySection = document.getElementById('gastos-agregados-section');
	const saveRendicionBtn = document.getElementById('save-rendicion-btn');
	const downloadExcelBtn = document.getElementById('download-excel-btn');

	// Mantenimiento
	const maintenanceContent = document.getElementById('maintenance-content');
	const maintenanceNav = document.querySelector('.maintenance-nav');
	const btnAddNew = document.getElementById('btn-add-new');

	// Modal
	const modal = document.getElementById('generic-modal');
	const modalTitle = document.getElementById('modal-title');
	const modalBody = document.getElementById('modal-body');
	const modalSaveBtn = document.getElementById('modal-save-btn');
	const modalCancelBtn = document.getElementById('modal-cancel-btn');
	const modalCloseBtn = modal.querySelector('.close-button');

	// ===================================================================================
	// UTILIDADES API
	// ===================================================================================
	const apiCall = async (endpoint, options = {}) => {
		const url = `${API_BASE_URL}${endpoint}`;
		const config = {
			headers: {
				'Content-Type': 'application/json',
				...(authToken && { Authorization: `Bearer ${authToken}` }),
			},
			...options,
		};

		if (options.body && typeof options.body === 'object') {
			config.body = JSON.stringify(options.body);
		}

		try {
			const response = await fetch(url, config);

			if (response.status === 401) {
				localStorage.removeItem('authToken');
				authToken = null;
				// Solo llamar handleLogout si ya hay usuario logueado
				if (state.currentUser) {
					handleLogout();
					throw new Error('Sesión expirada');
				}
				throw new Error('Credenciales incorrectas');
			}

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || `Error ${response.status}`);
			}

			return data;
		} catch (error) {
			console.error('Error en API:', error);
			throw error;
		}
	};

	// ===================================================================================
	// AUTENTICACIÓN
	// ===================================================================================
	async function handleLogin(e) {
		e.preventDefault();

		try {
			const response = await apiCall('/login', {
				method: 'POST',
				body: {
					username: usernameInput.value,
					password: passwordInput.value,
				},
			});

			authToken = response.accessToken;
			localStorage.setItem('authToken', authToken);
			state.currentUser = response.user;

			loginScreen.classList.add('hidden');
			appScreen.classList.remove('hidden');
			loginError.textContent = '';
			usernameInput.value = '';
			passwordInput.value = '';

			await initializeApp();
		} catch (error) {
			loginError.textContent = error.message;
		}
	}

	function handleLogout() {
		state.currentUser = null;
		authToken = null;
		localStorage.removeItem('authToken');
		loginScreen.classList.remove('hidden');
		appScreen.classList.add('hidden');
		showAlert('Sesión cerrada con éxito.', 'info');
	}

	// ===================================================================================
	// INICIALIZACIÓN
	// ===================================================================================
	async function initializeApp() {
		if (!state.currentUser) return;

		try {
			// Cargar datos iniciales
			const initialData = await apiCall('/initial-data');
			state.apiData = initialData;

			// Configurar UI según rol
			userInfo.textContent = `Hola, ${state.currentUser.nombreCompleto} (${state.currentUser.role})`;

			if (state.currentUser.role === 'admin') {
				maintenanceTabBtn.classList.remove('hidden');
				document.getElementById('btn-add-viatico').classList.remove('hidden');
			} else {
				maintenanceTabBtn.classList.add('hidden');
				document.getElementById('btn-add-viatico').classList.add('hidden');
			}

			// Agregar campos de estado
			addEstadoFields();

			// Poblar selects
			populateSelect(
				clienteSelect,
				state.apiData.clients.map((c) => ({ value: c.Id, text: c.Nombre })),
				'Seleccionar Cliente'
			);

			populateSelect(
				cuentaSelect,
				state.apiData.expenseTypes.map((e) => ({ value: e.Id, text: e.Nombre })),
				'Seleccionar Tipo de Gasto'
			);

			// Configurar empleados
			if (state.currentUser.role === 'admin') {
				populateSelect(
					empleadoSelect,
					state.apiData.users.map((u) => ({ value: u.Id, text: u.NombreCompleto })),
					'Seleccionar Empleado'
				);
				empleadoSelect.disabled = false;
			} else {
				populateSelect(empleadoSelect, [
					{ value: state.currentUser.id, text: state.currentUser.nombreCompleto },
				]);
				empleadoSelect.value = state.currentUser.id;
				empleadoSelect.disabled = true;
			}

			// Cargar balance viáticos y vistas
			await loadViaticosBalance();
			resetFullForm();
			await loadHistory();
			renderMaintenanceView();
			showTab('nueva-rendicion');
		} catch (error) {
			showAlert('Error al cargar datos iniciales: ' + error.message, 'error');
		}
	}

	// ===================================================================================
	// CAMPOS DE ESTADO
	// ===================================================================================
	function addEstadoFields() {
		const formSection = document.querySelector('.form-section');

		// Evitar duplicados
		if (document.getElementById('estado')) return;

		// Estado
		const estadoGroup = document.createElement('div');
		estadoGroup.className = 'form-group';
		estadoGroup.innerHTML = `
			<label for="estado">Estado de la Actividad</label>
			<select id="estado" class="form-control">
				<option value="Implementación">Implementación</option>
				<option value="Salida a Producción">Salida a Producción</option>
				<option value="Reparación">Reparación</option>
				<option value="Entrega de equipo">Entrega de equipo</option>
				<option value="Otro">Otro (especificar)</option>
			</select>
		`;

		// Estado Personalizado
		const estadoPersonalizadoGroup = document.createElement('div');
		estadoPersonalizadoGroup.className = 'form-group';
		estadoPersonalizadoGroup.style.display = 'none';
		estadoPersonalizadoGroup.innerHTML = `
			<label for="estado-personalizado">Estado Personalizado</label>
			<input type="text" id="estado-personalizado" class="form-control" placeholder="Especifique el estado">
		`;

		// Observaciones
		const observacionesGroup = document.createElement('div');
		observacionesGroup.className = 'form-group';
		observacionesGroup.style.gridColumn = '1 / -1';
		observacionesGroup.innerHTML = `
			<label for="observaciones">Observaciones</label>
			<textarea id="observaciones" class="form-control" rows="3" placeholder="Observaciones adicionales"></textarea>
		`;

		formSection.appendChild(estadoGroup);
		formSection.appendChild(estadoPersonalizadoGroup);
		formSection.appendChild(observacionesGroup);

		// Event listener
		document.getElementById('estado').addEventListener('change', function () {
			const estadoPersonalizadoGroup = document.getElementById(
				'estado-personalizado'
			).parentElement;
			if (this.value === 'Otro') {
				estadoPersonalizadoGroup.style.display = 'block';
			} else {
				estadoPersonalizadoGroup.style.display = 'none';
				document.getElementById('estado-personalizado').value = '';
			}
		});
	}

	// ===================================================================================
	// UTILIDADES UI
	// ===================================================================================
	function populateSelect(selectElement, options, placeholder = '') {
		selectElement.innerHTML = '';
		if (placeholder) {
			selectElement.add(new Option(placeholder, ''));
		}
		options.forEach((option) => {
			selectElement.add(new Option(option.text, option.value));
		});
	}

	function showTab(tabId) {
		document
			.querySelectorAll('.tab-content')
			.forEach((content) => content.classList.remove('active'));
		document
			.querySelectorAll('.nav-tab')
			.forEach((tab) => tab.classList.remove('active'));
		document.getElementById(tabId).classList.add('active');
		document.querySelector(`.nav-tab[data-tab="${tabId}"]`).classList.add('active');
	}

	function showAlert(message, type = 'success') {
		const alertContainer = document.getElementById('alert-container');
		const alertDiv = document.createElement('div');
		alertDiv.className = `alert alert-${type}`;
		alertDiv.innerHTML = `<span>${message}</span><button class="alert-close-btn">&times;</button>`;
		alertContainer.prepend(alertDiv);
		alertDiv
			.querySelector('.alert-close-btn')
			.addEventListener('click', () => alertDiv.remove());
		setTimeout(() => {
			alertDiv.style.opacity = '0';
			alertDiv.style.transform = 'translateX(100%)';
			setTimeout(() => alertDiv.remove(), 500);
		}, 5000);
	}

	// ===================================================================================
	// VIÁTICOS - AGREGAR
	// ===================================================================================
	async function loadViaticosBalance() {
		try {
			const balance = await apiCall('/viaticos/balance');
			state.viaticosBalance = balance;
			renderViaticosWidget();
			renderViaticosList();
		} catch (error) {
			console.error('Error cargando balance viáticos:', error);
			showAlert('Error cargando viáticos: ' + error.message, 'warning');
		}
	}

	function renderViaticosWidget() {
		const widgetContainer = document.getElementById('viaticos-widget');
		if (!widgetContainer) return;

		if (state.viaticosBalance.length === 0) {
			widgetContainer.innerHTML = `
				<div class="viaticos-empty">
					<p>No tienes viáticos asignados</p>
				</div>
			`;
			return;
		}

		const totalDisponible = state.viaticosBalance.reduce(
			(sum, v) => sum + v.SaldoDisponible,
			0
		);
		const totalAsignado = state.viaticosBalance.reduce(
			(sum, v) => sum + v.MontoAsignado,
			0
		);
		const totalGastado = state.viaticosBalance.reduce(
			(sum, v) => sum + v.MontoGastado,
			0
		);

		widgetContainer.innerHTML = `
			<div class="viaticos-summary">
				<div class="viatico-card total">
					<h4>Recibí adelanto por</h4>
					<span class="amount">$${totalAsignado.toFixed(2)}</span>
				</div>
				<div class="viatico-card gastado">
					<h4>Importe Rendido</h4>
					<span class="amount">$${totalGastado.toFixed(2)}</span>
				</div>
				<div class="viatico-card disponible">
					<h4>Me deben reintegrar</h4>
					<span class="amount ${totalDisponible < 0 ? 'negative' : 'positive'}">$${Math.abs(
			totalDisponible
		).toFixed(2)}</span>
				</div>
			</div>
			<div class="viaticos-detail">
				${state.viaticosBalance
					.map(
						(viatico) => `
					<div class="viatico-item ${getViaticoAlertClass(
						viatico.AlertaVencimiento
					)}" data-id="${viatico.Id}">
						<div class="viatico-info">
							<span class="descripcion">${viatico.Descripcion || 'Viático'}</span>
							<span class="fecha">Vence: ${new Date(viatico.FechaVencimiento).toLocaleDateString(
								'es-DO'
							)}</span>
							<span class="dias-restantes">${viatico.DiasRestantes} días restantes</span>
						</div>
						<div class="viatico-amounts">
							<small>Disponible: $${viatico.SaldoDisponible.toFixed(2)}</small>
						</div>
					</div>
				`
					)
					.join('')}
			</div>
			<button class="btn btn-primary btn-sm" onclick="showViaticoHistory()">Ver Historial</button>
		`;

		widgetContainer.querySelectorAll('.viatico-item').forEach((item) => {
			item.addEventListener('click', () => selectViatico(parseInt(item.dataset.id)));
		});
	}

	function getViaticoAlertClass(alerta) {
		switch (alerta) {
			case 'VENCIDO':
				return 'alert-red';
			case 'CRITICO':
				return 'alert-red';
			case 'ALERTA':
				return 'alert-yellow';
			default:
				return 'alert-green';
		}
	}

	function selectViatico(viaticoId) {
		state.selectedViatico = state.viaticosBalance.find((v) => v.Id === viaticoId);

		document.querySelectorAll('.viatico-item').forEach((item) => {
			item.classList.remove('selected');
		});
		document.querySelector(`[data-id="${viaticoId}"]`)?.classList.add('selected');

		showAlert(
			`Viático seleccionado: $${state.selectedViatico.SaldoDisponible.toFixed(
				2
			)} disponible`,
			'info'
		);
	}

	window.showViaticoHistory = async function () {
		if (state.viaticosBalance.length === 0) return;

		let historyHtml = '<h3>Historial de Viáticos</h3>';

		for (const viatico of state.viaticosBalance) {
			try {
				const movimientos = await apiCall(`/viaticos/${viatico.Id}/movimientos`);

				historyHtml += `
					<div class="viatico-history-section">
						<h4>${viatico.Descripcion || 'Viático'} - $${viatico.MontoAsignado.toFixed(2)}</h4>
						<table class="data-table">
							<thead>
								<tr><th>Fecha</th><th>Tipo</th><th>Monto</th><th>Descripción</th></tr>
							</thead>
							<tbody>
								${movimientos
									.map(
										(mov) => `
									<tr>
										<td>${new Date(mov.Fecha).toLocaleDateString('es-DO')}</td>
										<td><span class="badge ${mov.TipoMovimiento.toLowerCase()}">${
											mov.TipoMovimiento
										}</span></td>
										<td class="${mov.TipoMovimiento === 'Gasto' ? 'negative' : 'positive'}">
											${mov.TipoMovimiento === 'Gasto' ? '-' : '+'}$${mov.Monto.toFixed(2)}
										</td>
										<td>${mov.Descripcion || ''}</td>
									</tr>
								`
									)
									.join('')}
							</tbody>
						</table>
					</div>
				`;
			} catch (error) {
				console.error('Error cargando movimientos:', error);
			}
		}

		openModal('Historial de Viáticos', historyHtml, false);
	};

	function openViaticoModal() {
		const formHtml = `
			<div class="form-grid">
				<div class="form-group">
					<label for="viatico-usuario">Empleado</label>
					<select id="viatico-usuario" class="form-control">
						${state.apiData.users
							.map((u) => `<option value="${u.Id}">${u.NombreCompleto}</option>`)
							.join('')}
					</select>
				</div>
				<div class="form-group">
					<label for="viatico-monto">Monto Asignado</label>
					<input type="number" id="viatico-monto" class="form-control" step="0.01" required>
				</div>
				<div class="form-group">
					<label for="viatico-fecha-asignacion">Fecha Asignación</label>
					<input type="date" id="viatico-fecha-asignacion" class="form-control" value="${new Date()
						.toISOString()
						.slice(0, 10)}" required>
				</div>
				<div class="form-group">
					<label for="viatico-fecha-vencimiento">Fecha Vencimiento</label>
					<input type="date" id="viatico-fecha-vencimiento" class="form-control" required>
				</div>
				<div class="form-group" style="grid-column: 1 / -1;">
					<label for="viatico-descripcion">Descripción</label>
					<input type="text" id="viatico-descripcion" class="form-control" placeholder="Descripción del viático">
				</div>
			</div>
		`;

		modal.dataset.mode = 'add-viatico';
		openModal('Asignar Nuevo Viático', formHtml, true);
	}

	async function saveViatico() {
		try {
			const viaticoData = {
				usuarioId: parseInt(document.getElementById('viatico-usuario').value),
				montoAsignado: parseFloat(document.getElementById('viatico-monto').value),
				fechaAsignacion: document.getElementById('viatico-fecha-asignacion').value,
				fechaVencimiento: document.getElementById('viatico-fecha-vencimiento').value,
				descripcion: document.getElementById('viatico-descripcion').value,
			};

			await apiCall('/viaticos', {
				method: 'POST',
				body: viaticoData,
			});

			showAlert('Viático asignado exitosamente.', 'success');
			closeModal();
			await loadViaticosBalance();
		} catch (error) {
			showAlert('Error al asignar viático: ' + error.message, 'error');
		}
	}

	function renderViaticosList() {
		const detailContainer = document.getElementById('viaticos-balance-detail');
		if (!detailContainer || state.viaticosBalance.length === 0) return;

		detailContainer.innerHTML = `
        <h3>Viáticos Activos</h3>
        <table class="data-table">
            <thead>
                <tr><th>Empleado</th><th>Monto</th><th>Disponible</th><th>Vencimiento</th><th>Estado</th></tr>
            </thead>
            <tbody>
                ${state.viaticosBalance
									.map((v) => {
										const user = state.apiData.users.find(
											(u) => u.Id === v.UsuarioId
										);
										return `
                        <tr>
                            <td>${user?.NombreCompleto || 'N/A'}</td>
                            <td>$${v.MontoAsignado.toFixed(2)}</td>
                            <td>$${v.SaldoDisponible.toFixed(2)}</td>
                            <td>${new Date(v.FechaVencimiento).toLocaleDateString(
															'es-DO'
														)}</td>
                            <td><span class="badge ${getViaticoAlertClass(
															v.AlertaVencimiento
														).replace('alert-', '')}">${
											v.AlertaVencimiento
										}</span></td>
                        </tr>
                    `;
									})
									.join('')}
            </tbody>
        </table>
    `;
	}

	// ===================================================================================
	// FUNCIONES FORMULARIO - AGREGAR DESPUÉS DE saveViatico()
	// ===================================================================================
	function updateNumeroCuenta() {
		const selectedTypeId = parseInt(cuentaSelect.value);
		const expenseType = state.apiData.expenseTypes.find(
			(e) => e.Id === selectedTypeId
		);
		numeroCuentaInput.value = expenseType ? expenseType.Cuenta : '';
	}

	function updateSucursales() {
		const selectedClientId = parseInt(clienteSelect.value);
		const clientBranches = state.apiData.branches.filter(
			(b) => b.ClienteId === selectedClientId
		);
		populateSelect(
			sucursalSelect,
			clientBranches.map((b) => ({ value: b.Id, text: b.Nombre })),
			'Seleccionar Sucursal'
		);
	}

	function updateGastoTotal() {
		const importe = parseFloat(importeInput.value) || 0;
		const itbis = parseFloat(itbisInput.value) || 0;
		totalGastoInput.value = (importe + itbis).toFixed(2);
	}

	function addGasto() {
		const requiredFields = [
			document.getElementById('fecha'),
			document.getElementById('cliente'),
			document.getElementById('descripcion'),
			document.getElementById('cuenta'),
			document.getElementById('importe-sin-itbis'),
		];

		let isValid = true;
		requiredFields.forEach((field) => {
			if (!field.value) {
				isValid = false;
				field.style.borderColor = 'var(--danger-color)';
			} else {
				field.style.borderColor = 'var(--medium-gray)';
			}
		});

		if (!isValid) {
			showAlert('Complete todos los campos requeridos (*).', 'error');
			return;
		}

		const selectedExpenseType = state.apiData.expenseTypes.find(
			(e) => e.Id === parseInt(cuentaSelect.value)
		);
		const selectedClient = state.apiData.clients.find(
			(c) => c.Id === parseInt(clienteSelect.value)
		);

		const newGasto = {
			id: Date.now(),
			expenseTypeId: selectedExpenseType.Id,
			clientId: selectedClient.Id,
			branchId: parseInt(sucursalSelect.value) || null,
			fecha: document.getElementById('fecha').value,
			descripcion: document.getElementById('descripcion').value,
			importe: parseFloat(importeInput.value),
			itbis: parseFloat(itbisInput.value) || 0,
			total: parseFloat(totalGastoInput.value),
		};

		state.currentExpenses.push(newGasto);
		renderExpenses();
		resetGastoForm();
		showAlert('Gasto agregado a la rendición actual.', 'success');
	}

	function resetGastoForm() {
		const fieldsToReset = [
			'fecha',
			'cliente',
			'sucursal',
			'descripcion',
			'cuenta',
			'numero-cuenta',
			'importe-sin-itbis',
			'itbis',
			'total-gasto',
		];
		fieldsToReset.forEach((id) => {
			const field = document.getElementById(id);
			if (field) field.value = '';
		});
		sucursalSelect.innerHTML = '<option value="">Seleccionar Sucursal</option>';
	}

	function renderExpenses() {
		expensesContainer.innerHTML = '';
		if (state.currentExpenses.length > 0) {
			summarySection.classList.remove('hidden');
			state.currentExpenses.forEach((gasto) => {
				const expenseType = state.apiData.expenseTypes.find(
					(e) => e.Id === gasto.expenseTypeId
				);
				const client = state.apiData.clients.find((c) => c.Id === gasto.clientId);
				const expenseEl = document.createElement('div');
				expenseEl.className = 'expense-item';
				expenseEl.innerHTML = `
					<div>
						<div class="desc">${expenseType.Nombre}</div>
						<div class="date">Cliente: ${client.Nombre} | Fecha: ${gasto.fecha}</div>
					</div>
					<div>${gasto.descripcion}</div>
					<div class="amount">$${gasto.importe.toFixed(2)}</div>
					<div class="amount">$${gasto.itbis.toFixed(2)}</div>
					<button class="btn btn-danger btn-sm" data-id="${gasto.id}">🗑</button>
				`;
				expensesContainer.appendChild(expenseEl);
			});
			expensesContainer.querySelectorAll('.btn-danger').forEach((btn) => {
				btn.addEventListener('click', (e) => removeGasto(e.target.dataset.id));
			});
		} else {
			summarySection.classList.add('hidden');
		}
		updateSummary();
	}

	function removeGasto(id) {
		state.currentExpenses = state.currentExpenses.filter((g) => g.id != id);
		renderExpenses();
		showAlert('Gasto eliminado de la lista.', 'warning');
	}

	function updateSummary() {
		const totalSinItbis = state.currentExpenses.reduce(
			(sum, g) => sum + g.importe,
			0
		);
		const totalItbis = state.currentExpenses.reduce((sum, g) => sum + g.itbis, 0);
		const totalGeneral = totalSinItbis + totalItbis;

		document.getElementById(
			'total-sin-itbis'
		).textContent = `$${totalSinItbis.toFixed(2)}`;
		document.getElementById('total-itbis').textContent = `$${totalItbis.toFixed(2)}`;
		document.getElementById('total-general').textContent = `$${totalGeneral.toFixed(
			2
		)}`;
	}

	function resetFullForm() {
		state.currentExpenses = [];
		state.selectedViatico = null;

		if (state.currentUser.role === 'admin') empleadoSelect.value = '';

		if (document.getElementById('estado')) {
			document.getElementById('estado').value = 'Implementación';
			document.getElementById('estado-personalizado').value = '';
			document.getElementById('observaciones').value = '';
			document.getElementById('estado-personalizado').parentElement.style.display =
				'none';
		}

		document.querySelectorAll('.viatico-item').forEach((item) => {
			item.classList.remove('selected');
		});

		renderExpenses();
		resetGastoForm();
	}

	// ===================================================================================
	// GUARDADO Y HISTORIAL
	// ===================================================================================
	async function saveRendicion() {
		if (!empleadoSelect.value) {
			showAlert('Debe seleccionar un empleado.', 'error');
			return;
		}
		if (state.currentExpenses.length === 0) {
			showAlert('Debe agregar al menos un gasto.', 'error');
			return;
		}

		try {
			const estadoValue = document.getElementById('estado').value;
			const estadoPersonalizado =
				estadoValue === 'Otro'
					? document.getElementById('estado-personalizado').value
					: null;
			const observaciones = document.getElementById('observaciones').value || null;

			const rendicionData = {
				empleadoId: parseInt(empleadoSelect.value),
				gastos: state.currentExpenses,
				estado: estadoValue !== 'Otro' ? estadoValue : null,
				estadoPersonalizado: estadoPersonalizado,
				observaciones: observaciones,
				viaticoId: state.selectedViatico?.Id || null,
			};

			const response = await apiCall('/rendiciones', {
				method: 'POST',
				body: rendicionData,
			});

			showAlert(
				`Rendición ${response.codigoRendicion} guardada con éxito.`,
				'success'
			);
			await loadViaticosBalance();
			resetFullForm();
			await loadHistory();
		} catch (error) {
			showAlert('Error al guardar: ' + error.message, 'error');
		}
	}

	async function loadHistory() {
		try {
			const rendiciones = await apiCall('/rendiciones');
			const historyBody = document.getElementById('history-body');
			historyBody.innerHTML = '';

			rendiciones.reverse().forEach((r) => {
				const row = historyBody.insertRow();
				row.innerHTML = `
					<td>${r.CodigoRendicion || r.id}</td>
					<td>${new Date(r.FechaCreacion).toLocaleDateString('es-DO')}</td>
					<td>${r.NombreEmpleado || r.empleado}</td>
					<td>$${parseFloat(r.Total).toFixed(2)}</td>
					<td>${r.TotalGastos}</td>
					<td class="actions">
						<button class="btn btn-primary btn-sm" data-id="${r.Id}">Ver</button>
						<button class="btn btn-success btn-sm" data-id="${r.Id}">📊 Excel</button>
					</td>
				`;
			});

			historyBody.querySelectorAll('.btn-primary').forEach((btn) => {
				btn.addEventListener('click', (e) => viewDetails(e.target.dataset.id));
			});

			historyBody.querySelectorAll('.btn-success').forEach((btn) => {
				btn.addEventListener('click', (e) =>
					downloadRendicionExcel(e.target.dataset.id)
				);
			});
		} catch (error) {
			showAlert('Error al cargar historial: ' + error.message, 'error');
		}
	}

	async function viewDetails(rendicionId) {
		try {
			const response = await apiCall(`/rendiciones/${rendicionId}`);
			const { rendicion, gastos } = response;

			let detailsHtml = `
				<p><strong>Código:</strong> ${rendicion.CodigoRendicion}</p>
				<p><strong>Empleado:</strong> ${rendicion.NombreEmpleado}</p>
				<p><strong>Fecha:</strong> ${new Date(rendicion.FechaCreacion).toLocaleDateString(
					'es-DO'
				)}</p>
				<p><strong>Estado:</strong> ${rendicion.EstadoPersonalizado || rendicion.Estado}</p>
				${
					rendicion.Observaciones
						? `<p><strong>Observaciones:</strong> ${rendicion.Observaciones}</p>`
						: ''
				}
				<table class="data-table" style="margin-top: 15px;">
					<thead><tr><th>Tipo</th><th>Cliente</th><th>Fecha</th><th>Descripción</th><th style="text-align:right;">Total</th></tr></thead>
					<tbody>
						${gastos
							.map(
								(g) => `
							<tr>
								<td>${g.TipoGasto}</td>
								<td>${g.Cliente}</td>
								<td>${new Date(g.Fecha).toLocaleDateString('es-DO')}</td>
								<td>${g.Descripcion}</td>
								<td style="text-align:right;">$${(g.ImporteSinItbis + g.Itbis).toFixed(2)}</td>
							</tr>
						`
							)
							.join('')}
					</tbody>
				</table>
				<h3 style="text-align:right; margin-top:15px;">Total: $${parseFloat(
					rendicion.Total
				).toFixed(2)}</h3>
			`;

			openModal('Detalles de la Rendición', detailsHtml, false);
		} catch (error) {
			showAlert('Error al obtener detalles: ' + error.message, 'error');
		}
	}

	async function downloadRendicionExcel(rendicionId) {
		try {
			const response = await fetch(
				`${API_BASE_URL}/rendiciones/${rendicionId}/export-excel`,
				{
					headers: { Authorization: `Bearer ${authToken}` },
				}
			);

			if (!response.ok) {
				throw new Error('Error al exportar');
			}

			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.style.display = 'none';
			a.href = url;
			a.download = `Rendicion_Viaticos_${rendicionId}_${new Date()
				.toISOString()
				.slice(0, 10)}.xlsx`;
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
			document.body.removeChild(a);

			showAlert('Excel descargado exitosamente.', 'success');
		} catch (error) {
			showAlert('Error al descargar: ' + error.message, 'error');
		}
	}

	function exportToExcel() {
		if (state.currentExpenses.length === 0) {
			showAlert('No hay gastos para exportar.', 'error');
			return;
		}

		const empleado = state.apiData.users.find(
			(u) => u.Id === parseInt(empleadoSelect.value)
		);
		const data = state.currentExpenses.map((gasto) => {
			const type = state.apiData.expenseTypes.find(
				(t) => t.Id === gasto.expenseTypeId
			);
			const client = state.apiData.clients.find((c) => c.Id === gasto.clientId);
			return {
				Empleado: empleado.NombreCompleto,
				'Tipo de Gasto': type.Nombre,
				'Nº de Cuenta': type.Cuenta,
				'Importe sin ITBIS': gasto.importe,
				'ITBIS 18%': gasto.itbis,
				'Total Gasto': gasto.total,
				Cliente: client.Nombre,
				Fecha: gasto.fecha,
				Descripción: gasto.descripcion,
			};
		});

		if (typeof XLSX !== 'undefined') {
			const worksheet = XLSX.utils.json_to_sheet(data);
			const workbook = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(workbook, worksheet, 'Rendicion');
			XLSX.writeFile(
				workbook,
				`Rendicion_${empleado.Username}_${new Date()
					.toISOString()
					.slice(0, 10)}.xlsx`
			);
		} else {
			showAlert('Error: Librería XLSX no disponible.', 'error');
		}
	}
	// ===================================================================================
	// MANTENIMIENTO (CRUD)
	// ===================================================================================
	function renderMaintenanceView() {
		const entity = state.currentMaintenanceEntity;
		maintenanceContent.innerHTML = '';
		let tableHtml = '';

		switch (entity) {
			case 'users':
				tableHtml = `
                <table class="data-table">
                    <thead><tr><th>ID</th><th>Nombre</th><th>Username</th><th>Rol</th><th>Acciones</th></tr></thead>
                    <tbody>${state.apiData.users
											.map(
												(u) => `
                        <tr>
                            <td>${u.Id}</td>
                            <td>${u.NombreCompleto}</td>
                            <td>${u.Username}</td>
                            <td>${u.Role}</td>
                            <td class="actions">
                                <button class="btn btn-warning btn-sm" data-entity="users" data-id="${u.Id}">✏️</button>
                                <button class="btn btn-danger btn-sm" data-entity="users" data-id="${u.Id}">🗑️</button>
                            </td>
                        </tr>
                    `
											)
											.join('')}</tbody>
                </table>`;
				break;
			case 'clients':
				tableHtml = `
                <table class="data-table">
                    <thead><tr><th>ID</th><th>Cliente</th><th>Acciones</th></tr></thead>
                    <tbody>${state.apiData.clients
											.map(
												(c) => `
                        <tr>
                            <td>${c.Id}</td>
                            <td>${c.Nombre}</td>
                            <td class="actions">
                                <button class="btn btn-warning btn-sm" data-entity="clients" data-id="${c.Id}">✏️</button>
                                <button class="btn btn-danger btn-sm" data-entity="clients" data-id="${c.Id}">🗑️</button>
                            </td>
                        </tr>
                    `
											)
											.join('')}</tbody>
                </table>`;
				break;
			case 'branches':
				tableHtml = `
                <table class="data-table">
                    <thead><tr><th>ID</th><th>Sucursal</th><th>Cliente</th><th>Ubicación</th><th>Acciones</th></tr></thead>
                    <tbody>${state.apiData.branches
											.map((b) => {
												const client = state.apiData.clients.find(
													(c) => c.Id === b.ClienteId
												);
												return `
                            <tr>
                                <td>${b.Id}</td>
                                <td>${b.Nombre}</td>
                                <td>${client?.Nombre || 'N/A'}</td>
                                <td>${b.Ubicacion}</td>
                                <td class="actions">
                                    <button class="btn btn-warning btn-sm" data-entity="branches" data-id="${
																			b.Id
																		}">✏️</button>
                                    <button class="btn btn-danger btn-sm" data-entity="branches" data-id="${
																			b.Id
																		}">🗑️</button>
                                </td>
                            </tr>
                        `;
											})
											.join('')}</tbody>
                </table>`;
				break;
			case 'expenseTypes':
				tableHtml = `
                <table class="data-table">
                    <thead><tr><th>ID</th><th>Nombre</th><th>Cuenta</th><th>Acciones</th></tr></thead>
                    <tbody>${state.apiData.expenseTypes
											.map(
												(e) => `
                        <tr>
                            <td>${e.Id}</td>
                            <td>${e.Nombre}</td>
                            <td>${e.Cuenta}</td>
                            <td class="actions">
                                <button class="btn btn-warning btn-sm" data-entity="expenseTypes" data-id="${e.Id}">✏️</button>
                                <button class="btn btn-danger btn-sm" data-entity="expenseTypes" data-id="${e.Id}">🗑️</button>
                            </td>
                        </tr>
                    `
											)
											.join('')}</tbody>
                </table>`;
				break;
		}
		maintenanceContent.innerHTML = tableHtml;
	}

	async function handleMaintenanceAction(e) {
		const target = e.target.closest('button');
		if (!target) return;

		const { entity, id } = target.dataset;

		if (target.classList.contains('btn-warning')) {
			openEditModal(entity, parseInt(id));
		}
		if (target.classList.contains('btn-danger')) {
			if (confirm('¿Eliminar este registro?')) {
				await deleteEntity(entity, parseInt(id));
			}
		}
	}

	async function deleteEntity(entity, id) {
		try {
			const endpoints = {
				users: '/usuarios',
				clients: '/clientes',
				branches: '/sucursales',
				expenseTypes: '/tipos-gastos',
			};

			await apiCall(`${endpoints[entity]}/${id}`, { method: 'DELETE' });
			showAlert('Registro eliminado.', 'warning');

			const initialData = await apiCall('/initial-data');
			state.apiData = initialData;
			renderMaintenanceView();
		} catch (error) {
			showAlert('Error: ' + error.message, 'error');
		}
	}

	// ===================================================================================
	// MODAL
	// ===================================================================================
	function openModal(title, bodyHtml, showSaveButton = true) {
		modalTitle.textContent = title;
		modalBody.innerHTML = bodyHtml;
		modalSaveBtn.style.display = showSaveButton ? 'inline-flex' : 'none';
		modal.style.display = 'block';
	}

	function closeModal() {
		modal.style.display = 'none';
		modal.removeAttribute('data-mode');
		modal.removeAttribute('data-entity');
		modal.removeAttribute('data-id');
	}

	// ===================================================================================
	// VERIFICAR SESIÓN EXISTENTE
	// ===================================================================================
	async function checkExistingSession() {
		if (authToken) {
			try {
				const initialData = await apiCall('/initial-data');
				state.apiData = initialData;

				const tokenPayload = JSON.parse(atob(authToken.split('.')[1]));
				state.currentUser = {
					id: tokenPayload.id,
					nombreCompleto: tokenPayload.username,
					username: tokenPayload.username,
					role: tokenPayload.role,
				};

				loginScreen.classList.add('hidden');
				appScreen.classList.remove('hidden');
				await initializeApp();
			} catch (error) {
				localStorage.removeItem('authToken');
				authToken = null;
			}
		}
	}

	// ===================================================================================
	// EVENT LISTENERS
	// ===================================================================================
	function setupEventListeners() {
		// Login/Logout
		loginForm.addEventListener('submit', handleLogin);
		logoutBtn.addEventListener('click', handleLogout);

		// Navegación
		document.querySelectorAll('.nav-tab').forEach((tab) => {
			tab.addEventListener('click', () => showTab(tab.dataset.tab));
		});

		// Formulario gastos
		cuentaSelect.addEventListener('change', updateNumeroCuenta);
		clienteSelect.addEventListener('change', updateSucursales);
		importeInput.addEventListener('input', updateGastoTotal);
		itbisInput.addEventListener('input', updateGastoTotal);
		addGastoBtn.addEventListener('click', addGasto);

		// Rendición
		saveRendicionBtn.addEventListener('click', saveRendicion);
		downloadExcelBtn.addEventListener('click', exportToExcel);

		// Mantenimiento
		maintenanceNav.addEventListener('click', (e) => {
			if (e.target.classList.contains('maintenance-nav-btn')) {
				maintenanceNav.querySelector('.active').classList.remove('active');
				e.target.classList.add('active');
				state.currentMaintenanceEntity = e.target.dataset.entity;
				renderMaintenanceView();
			}
		});
		maintenanceContent.addEventListener('click', handleMaintenanceAction);

		btnAddNew.addEventListener('click', () => {
			openAddModal();
		});

		// Función openAddModal:
		function openAddModal() {
			const entity = state.currentMaintenanceEntity;
			let formHtml = '';
			let title = 'Agregar Nuevo';

			switch (entity) {
				case 'users':
					title = 'Agregar Usuario';
					formHtml = `
                <div class="form-grid">
                    <div class="form-group"><label>Nombre Completo</label><input type="text" id="nombreCompleto" class="form-control"></div>
                    <div class="form-group"><label>Username</label><input type="text" id="username" class="form-control"></div>
                    <div class="form-group"><label>Password</label><input type="password" id="password" class="form-control"></div>
                    <div class="form-group"><label>Rol</label><select id="role" class="form-control"><option value="user">User</option><option value="admin">Admin</option></select></div>
                </div>`;
					break;
				case 'clients':
					title = 'Agregar Cliente';
					formHtml = `<div class="form-group"><label>Nombre</label><input type="text" id="nombre" class="form-control"></div>`;
					break;
				case 'branches':
					title = 'Agregar Sucursal';
					const clientOptions = state.apiData.clients
						.map((c) => `<option value="${c.Id}">${c.Nombre}</option>`)
						.join('');
					formHtml = `
                <div class="form-grid">
                    <div class="form-group"><label>Cliente</label><select id="clienteId" class="form-control">${clientOptions}</select></div>
                    <div class="form-group"><label>Nombre</label><input type="text" id="nombre" class="form-control"></div>
                    <div class="form-group"><label>Ubicación</label><input type="text" id="ubicacion" class="form-control"></div>
                </div>`;
					break;
				case 'expenseTypes':
					title = 'Agregar Tipo de Gasto';
					formHtml = `
                <div class="form-grid">
                    <div class="form-group"><label>Nombre</label><input type="text" id="nombre" class="form-control"></div>
                    <div class="form-group"><label>Cuenta</label><input type="text" id="cuenta" class="form-control"></div>
                </div>`;
					break;
			}

			modal.dataset.mode = 'add';
			modal.dataset.entity = entity;
			openModal(title, formHtml, true);
		}

		// Viáticos
		if (document.getElementById('btn-add-viatico')) {
			document
				.getElementById('btn-add-viatico')
				.addEventListener('click', openViaticoModal);
		}

		// Modal
		modalCloseBtn.addEventListener('click', closeModal);
		modalCancelBtn.addEventListener('click', closeModal);
		modalSaveBtn.addEventListener('click', (e) => {
			if (modal.dataset.mode === 'add-viatico') {
				saveViatico();
			} else {
				handleSaveModal();
			}
		});

		window.addEventListener('click', (e) => {
			if (e.target === modal) closeModal();
		});

		// Función global
		window.showViaticoHistory = showViaticoHistory;
	}

	// ===================================================================================
	// INICIALIZAR
	// ===================================================================================
	setupEventListeners();
	checkExistingSession();

	// Placeholder para funciones para abrir y manejar el modal de edición
	function openEditModal(entity, id) {
		const dataMap = {
			users: state.apiData.users,
			clients: state.apiData.clients,
			branches: state.apiData.branches,
			expenseTypes: state.apiData.expenseTypes,
		};

		const item = dataMap[entity].find((i) => i.Id === id);
		if (!item) return;

		let formHtml = '';
		let title = '';

		switch (entity) {
			case 'users':
				title = 'Editar Usuario';
				formHtml = `
                <div class="form-grid">
                    <div class="form-group"><label>Nombre Completo</label><input type="text" id="nombreCompleto" class="form-control" value="${
											item.NombreCompleto
										}"></div>
                    <div class="form-group"><label>Username</label><input type="text" id="username" class="form-control" value="${
											item.Username
										}"></div>
                    <div class="form-group"><label>Nueva Password (opcional)</label><input type="password" id="password" class="form-control"></div>
                    <div class="form-group"><label>Rol</label><select id="role" class="form-control"><option value="user" ${
											item.Role === 'user' ? 'selected' : ''
										}>User</option><option value="admin" ${
					item.Role === 'admin' ? 'selected' : ''
				}>Admin</option></select></div>
                </div>`;
				break;
			case 'clients':
				title = 'Editar Cliente';
				formHtml = `<div class="form-group"><label>Nombre</label><input type="text" id="nombre" class="form-control" value="${item.Nombre}"></div>`;
				break;
			case 'branches':
				title = 'Editar Sucursal';
				const clientOptions = state.apiData.clients
					.map(
						(c) =>
							`<option value="${c.Id}" ${
								c.Id === item.ClienteId ? 'selected' : ''
							}>${c.Nombre}</option>`
					)
					.join('');
				formHtml = `
                <div class="form-grid">
                    <div class="form-group"><label>Cliente</label><select id="clienteId" class="form-control">${clientOptions}</select></div>
                    <div class="form-group"><label>Nombre</label><input type="text" id="nombre" class="form-control" value="${item.Nombre}"></div>
                    <div class="form-group"><label>Ubicación</label><input type="text" id="ubicacion" class="form-control" value="${item.Ubicacion}"></div>
                </div>`;
				break;
			case 'expenseTypes':
				title = 'Editar Tipo de Gasto';
				formHtml = `
                <div class="form-grid">
                    <div class="form-group"><label>Nombre</label><input type="text" id="nombre" class="form-control" value="${item.Nombre}"></div>
                    <div class="form-group"><label>Cuenta</label><input type="text" id="cuenta" class="form-control" value="${item.Cuenta}"></div>
                </div>`;
				break;
		}

		modal.dataset.mode = 'edit';
		modal.dataset.entity = entity;
		modal.dataset.id = id;
		openModal(title, formHtml, true);
	}

	async function handleSaveModal() {
		const { mode, entity, id } = modal.dataset;
		const formElements = modal.querySelectorAll('.form-control');
		const newItem = {};

		formElements.forEach((el) => {
			if (el.value || el.id !== 'password') {
				newItem[el.id] = el.value;
			}
		});

		try {
			const endpoints = {
				users: '/usuarios',
				clients: '/clientes',
				branches: '/sucursales',
				expenseTypes: '/tipos-gastos',
			};

			if (mode === 'add') {
				await apiCall(endpoints[entity], {
					method: 'POST',
					body: newItem,
				});
				showAlert('Registro agregado exitosamente.', 'success');
			} else {
				await apiCall(`${endpoints[entity]}/${id}`, {
					method: 'PUT',
					body: newItem,
				});
				showAlert('Registro actualizado exitosamente.', 'success');
			}

			closeModal();

			// Recargar datos
			const initialData = await apiCall('/initial-data');
			state.apiData = initialData;
			renderMaintenanceView();

			// Recargar selects en formulario principal
			if (state.currentUser) {
				populateSelect(
					clienteSelect,
					state.apiData.clients.map((c) => ({ value: c.Id, text: c.Nombre })),
					'Seleccionar Cliente'
				);
				populateSelect(
					cuentaSelect,
					state.apiData.expenseTypes.map((e) => ({ value: e.Id, text: e.Nombre })),
					'Seleccionar Tipo de Gasto'
				);
			}
		} catch (error) {
			showAlert('Error: ' + error.message, 'error');
		}
	}
});
