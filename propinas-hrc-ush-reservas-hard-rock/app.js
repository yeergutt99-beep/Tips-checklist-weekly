const STORAGE_KEY = "hrc-tip-checklist-v1";

const ADMIN_USERNAME = "admin9410";

const DEFAULT_WAITERS = [
  "Eleana",
  "Rocio",
  "Carlos",
  "Johana",
  "Cesar",
  "Evelyn",
  "Veronica",
  "Mario",
  "Camarero 9",
  "Camarero 10",
];

const DAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

// DOM
const loginScreen = document.getElementById("loginScreen");
const appShell = document.getElementById("appShell");
const loginInput = document.getElementById("loginInput");
const loginBtn = document.getElementById("loginBtn");
const loginMessage = document.getElementById("loginMessage");
const weekPicker = document.getElementById("weekPicker");
const logoutBtn = document.getElementById("logoutBtn");
const activeUserPill = document.getElementById("activeUserPill");

const tableHead = document.querySelector("#checklistTable thead");
const tableBody = document.querySelector("#checklistTable tbody");
const pendingGrid = document.getElementById("pendingGrid");

// STATE
const state = {
  data: loadState(),
  session: null,
};

// HELPERS
function getCurrentWeekValue() {
  const now = new Date();
  const temp = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((temp - yearStart) / 86400000 + 1) / 7);
  return `${temp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function normalizeName(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.waiters) && parsed.weeks) {
        return parsed;
      }
    } catch {}
  }

  return {
    waiters: DEFAULT_WAITERS.map((name, index) => ({
      id: `w${index + 1}`,
      name,
    })),
    weeks: {},
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function ensureWeekData(weekId) {
  if (!state.data.weeks[weekId]) {
    const waiterRows = {};
    state.data.waiters.forEach((w) => {
      waiterRows[w.id] = DAY_LABELS.map(() => ({
        waiterStatus: "",
        adminApproved: false,
      }));
    });
    state.data.weeks[weekId] = { rows: waiterRows };
    saveState();
  }
}

// LOGIN
function findWaiterByTypedName(name) {
  const normalizedTyped = normalizeName(name);
  return state.data.waiters.find(
    (waiter) => normalizeName(waiter.name) === normalizedTyped
  );
}

function updateSessionUI() {
  if (!state.session) {
    loginScreen.classList.remove("hidden");
    appShell.classList.add("hidden");
    return;
  }

  loginScreen.classList.add("hidden");
  appShell.classList.remove("hidden");

  if (state.session.role === "admin") {
    activeUserPill.textContent = `Sesión activa: Administrador`;
    return;
  }

  activeUserPill.textContent = `Sesión activa: ${state.session.name}`;
}

function buildTableHead() {
  const tr = document.createElement("tr");

  const th = document.createElement("th");
  th.textContent = "Camarero";
  tr.append(th);

  DAY_LABELS.forEach((day) => {
    const th = document.createElement("th");
    th.textContent = day;
    tr.append(th);
  });

  tableHead.innerHTML = "";
  tableHead.append(tr);
}

function canEditWaiterRow(waiterId) {
  return state.session?.role === "camarero" && state.session.waiterId === waiterId;
}

function isAdmin() {
  return state.session?.role === "admin";
}

// PENDING GRID
function updatePendingGrid(weekId) {
  const weekRows = state.data.weeks[weekId].rows;
  pendingGrid.innerHTML = "";

  DAY_LABELS.forEach((day, dayIndex) => {
    const notCompleted = state.data.waiters.filter((waiter) => {
      const cell = weekRows[waiter.id]?.[dayIndex];
      return !(cell && cell.waiterStatus && cell.adminApproved);
    });

    const card = document.createElement("div");
    card.className = "pending-card";

    const title = document.createElement("h3");
    title.textContent = day;
    card.append(title);

    if (notCompleted.length === 0) {
      const p = document.createElement("p");
      p.textContent = "Todo completo";
      card.append(p);
    } else {
      notCompleted.forEach((w) => {
        const p = document.createElement("p");
        p.textContent = w.name;
        card.append(p);
      });
    }

    pendingGrid.append(card);
  });
}

// RENDER
function renderWeek() {
  if (!state.session) return;

  const weekId = weekPicker.value;
  ensureWeekData(weekId);

  const weekRows = state.data.weeks[weekId].rows;
  tableBody.innerHTML = "";

  state.data.waiters.forEach((waiter) => {
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.textContent = waiter.name;
    tr.append(tdName);

    DAY_LABELS.forEach((_, i) => {
      const td = document.createElement("td");

      const cell = weekRows[waiter.id][i];

      const select = document.createElement("select");
      ["", "OK", "Otro Area", "FRANCO"].forEach((val) => {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = val || "-";
        select.append(opt);
      });

select.value = cell.waiterStatus;
select.disabled = !canEditWaiterRow(waiter.id) || cell.adminApproved;

      select.addEventListener("change", () => {
        cell.waiterStatus = select.value;
        saveState();
        renderWeek();
      });

      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = cell.adminApproved;
      check.disabled = !isAdmin();

      check.addEventListener("change", () => {
        cell.adminApproved = check.checked;
        saveState();
        renderWeek();
      });

      // 🎨 COLORES
      td.classList.remove("ok", "otro", "franco", "na");

      if (!cell.waiterStatus) td.classList.add("na"); // rojo
      else if (cell.waiterStatus === "OK") td.classList.add("ok");
      else if (cell.waiterStatus === "Otro Area") td.classList.add("otro");
      else if (cell.waiterStatus === "FRANCO") td.classList.add("franco");

      td.append(select, check);
      tr.append(td);
    });

    tableBody.append(tr);
  });

  updatePendingGrid(weekId);
}

// AUTH
function login() {
  const typed = loginInput.value.trim();

  if (!typed) {
    loginMessage.textContent = "Ingresá un usuario";
    return;
  }

  if (typed === ADMIN_USERNAME) {
    state.session = { role: "admin", name: "Admin" };
  } else {
    const waiter = findWaiterByTypedName(typed);
    if (!waiter) {
      loginMessage.textContent = "Usuario inválido";
      return;
    }
    state.session = {
      role: "camarero",
      waiterId: waiter.id,
      name: waiter.name,
    };
  }

  loginMessage.textContent = "";
  updateSessionUI();
  renderWeek();
}

function logout() {
  state.session = null;
  loginInput.value = "";
  updateSessionUI();
}

// INIT
function init() {
  weekPicker.value = getCurrentWeekValue();
  buildTableHead();
  updateSessionUI();

  loginBtn.addEventListener("click", login);
  logoutBtn.addEventListener("click", logout);

  loginInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") login();
  });
}

init();