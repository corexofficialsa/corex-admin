const STORAGE_KEY = "corex-admin-data-v1";
const AUTH_KEY = "corex-admin-auth-v1";
const AUTH_EXPIRY_KEY = "corex-admin-auth-expiry-v1";
const REMEMBER_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const LOGIN = {
  username: "COREX_OFFICIAL",
  password: "COREX3223!",
};

const PRICE_MAP = {
  SEO: 500,
  "Web Development": 100,
  "Web Development + SEO": 1500,
  "Complete Project": 3000,
};

const DEFAULT_STEPS = [
  "Build website according to the client's needs",
  "Meeting with client",
  "Apply requested changes or confirm khalas",
  "Update to the domain and deploy",
  "Handover to client",
];

const state = loadState();

const loginScreen = document.getElementById("loginScreen");
const appRoot = document.getElementById("appRoot");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const rememberMeInput = document.getElementById("rememberMe");
const logoutBtn = document.getElementById("logoutBtn");
const menuItems = [...document.querySelectorAll(".menu-item")];
const tabPanels = [...document.querySelectorAll(".tab-panel")];
const pageTitle = document.getElementById("pageTitle");
const projectForm = document.getElementById("projectForm");
const categorySelect = document.getElementById("categorySelect");
const priceInput = document.getElementById("priceInput");
const ongoingProjectsList = document.getElementById("ongoingProjectsList");
const completedProjectsList = document.getElementById("completedProjectsList");
const statsGrid = document.getElementById("statsGrid");
const activityFeed = document.getElementById("activityFeed");
const totalProjectsHero = document.getElementById("totalProjectsHero");
const invoiceCounterLabel = document.getElementById("invoiceCounterLabel");
const projectModal = document.getElementById("projectModal");
const modalContent = document.getElementById("modalContent");
const modalClose = document.getElementById("modalClose");
const menuOpen = document.getElementById("menuOpen");
const menuClose = document.getElementById("menuClose");
const sidebar = document.getElementById("sidebar");

boot();

function boot() {
  bindEvents();
  syncAuth();
  setActiveTab("dashboard");
  renderAll();
}

function bindEvents() {
  loginForm.addEventListener("submit", handleLogin);
  logoutBtn.addEventListener("click", handleLogout);
  categorySelect.addEventListener("change", handleCategoryChange);
  projectForm.addEventListener("submit", handleProjectSubmit);
  modalClose.addEventListener("click", closeModal);
  projectModal.addEventListener("click", (event) => {
    if (event.target.dataset.closeModal) closeModal();
  });
  menuOpen.addEventListener("click", () => sidebar.classList.add("open"));
  menuClose.addEventListener("click", () => sidebar.classList.remove("open"));

  menuItems.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveTab(button.dataset.tab);
      sidebar.classList.remove("open");
    });
  });

  document.addEventListener("click", (event) => {
    const viewTrigger = event.target.closest("[data-view-project]");
    const downloadTrigger = event.target.closest("[data-download-invoice]");
    const completeTrigger = event.target.closest("[data-complete-project]");
    const websiteTrigger = event.target.closest("[data-visit-website]");
    const deleteTrigger = event.target.closest("[data-delete-project]");

    if (viewTrigger) openProjectModal(viewTrigger.dataset.viewProject, viewTrigger.dataset.type);
    if (downloadTrigger) downloadInvoice(downloadTrigger.dataset.downloadInvoice);
    if (completeTrigger) renderCompleteProjectForm(completeTrigger.dataset.completeProject);
    if (websiteTrigger) window.open(websiteTrigger.dataset.visitWebsite, "_blank", "noopener");
    if (deleteTrigger) deleteCompletedProject(deleteTrigger.dataset.deleteProject);
  });

  document.addEventListener("change", async (event) => {
    const stepBox = event.target.closest("[data-step-checkbox]");
    const fileInput = event.target.closest("[data-image-input]");

    if (stepBox) {
      const { projectId, stepIndex } = stepBox.dataset;
      updateProjectStep(projectId, Number(stepIndex), stepBox.checked);
    }

    if (fileInput) {
      const previewId = fileInput.dataset.previewTarget;
      const file = fileInput.files?.[0];
      if (!file) return;
      const result = await fileToOptimizedDataUrl(file);
      const preview = document.getElementById(previewId);
      preview.value = result;
      const targetImg = document.querySelector(`[data-preview-image="${previewId}"]`);
      if (targetImg) targetImg.src = result;
    }
  });

  window.addEventListener("resize", renderChart);
}

function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const rememberMe = rememberMeInput.checked;

  if (username === LOGIN.username && password === LOGIN.password) {
    localStorage.setItem(AUTH_KEY, "true");
    if (rememberMe) {
      localStorage.setItem(AUTH_EXPIRY_KEY, String(Date.now() + REMEMBER_DURATION_MS));
    } else {
      localStorage.removeItem(AUTH_EXPIRY_KEY);
    }
    loginError.textContent = "";
    syncAuth();
    return;
  }

  loginError.textContent = "Invalid username or password.";
}

function handleLogout() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(AUTH_EXPIRY_KEY);
  loginForm.reset();
  syncAuth();
}

function syncAuth() {
  const isAuthed = getAuthState();
  loginScreen.classList.toggle("hidden", isAuthed);
  appRoot.classList.toggle("hidden", !isAuthed);
}

function getAuthState() {
  const isAuthed = localStorage.getItem(AUTH_KEY) === "true";
  if (!isAuthed) return false;

  const expiry = Number(localStorage.getItem(AUTH_EXPIRY_KEY) || 0);
  if (!expiry) return true;

  if (Date.now() <= expiry) return true;

  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(AUTH_EXPIRY_KEY);
  return false;
}

function handleCategoryChange() {
  const category = categorySelect.value;
  if (category === "Custom Work") {
    priceInput.readOnly = false;
    priceInput.value = "";
    priceInput.placeholder = "Enter custom price";
    return;
  }

  priceInput.readOnly = true;
  priceInput.placeholder = "";
  priceInput.value = PRICE_MAP[category] ?? "";
}

function handleProjectSubmit(event) {
  event.preventDefault();
  const formData = new FormData(projectForm);
  const category = formData.get("category");
  const price = Number(formData.get("price"));
  const discount = Number(formData.get("discount") || 0);
  const advancePaid = Number(formData.get("advancePaid") || 0);

  const project = {
    id: crypto.randomUUID(),
    status: "ongoing",
    clientName: formData.get("clientName").trim() || "—",
    companyName: formData.get("companyName").trim(),
    phone: formData.get("phone").trim(),
    email: formData.get("email").trim(),
    category,
    price,
    discount,
    advancePaid,
    startDate: formData.get("startDate"),
    handoverDate: formData.get("handoverDate"),
    notes: formData.get("notes").trim(),
    createdAt: new Date().toISOString(),
    invoiceNumber: null,
    websiteLink: "",
    completedAt: "",
    completionClientName: "",
    websiteImage: "",
    clientLogo: "",
    steps: DEFAULT_STEPS.map((title) => ({ title, done: false })),
  };

  state.projects.unshift(project);
  if (!persistStateSafely()) return;
  projectForm.reset();
  priceInput.value = "";
  priceInput.readOnly = true;
  renderAll();
  setActiveTab("ongoing");
}

function renderAll() {
  renderStats();
  renderActivity();
  renderOngoingProjects();
  renderCompletedProjects();
  renderChart();
  invoiceCounterLabel.textContent = `#${String(state.invoiceCounter).padStart(4, "0")}`;
}

function renderStats() {
  const completed = state.projects.filter((project) => project.status === "completed");
  const ongoing = state.projects.filter((project) => project.status === "ongoing");
  const totalRevenue = state.projects.reduce((sum, project) => sum + netAmount(project), 0);
  const receivedAmount = completed.reduce((sum, project) => sum + netAmount(project), 0);
  const pendingAmount = ongoing.reduce((sum, project) => sum + Math.max(netAmount(project) - project.advancePaid, 0), 0);
  const discounts = state.projects.reduce((sum, project) => sum + Number(project.discount || 0), 0);
  const advanceCollection = ongoing.reduce((sum, project) => sum + Number(project.advancePaid || 0), 0);
  const cards = [
    { label: "Total Revenue", value: formatSar(totalRevenue) },
    { label: "Amount Received", value: formatSar(receivedAmount + advanceCollection) },
    { label: "Pending Amount", value: formatSar(pendingAmount) },
    { label: "Completed Works", value: String(completed.length) },
    { label: "Pending Works", value: String(ongoing.length) },
    { label: "Discount Given", value: formatSar(discounts) },
  ];

  totalProjectsHero.textContent = `${state.projects.length} Projects`;
  statsGrid.innerHTML = cards
    .map(
      (card) => `
        <article class="stat-card">
          <p>${card.label}</p>
          <strong>${card.value}</strong>
        </article>
      `,
    )
    .join("");
}

function renderActivity() {
  const items = [...state.projects]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  if (!items.length) {
    activityFeed.innerHTML = `<div class="empty-state"><h4>No activity yet</h4><p>Add your first project to start tracking COREX work.</p></div>`;
    return;
  }

  activityFeed.innerHTML = items
    .map(
      (project) => `
        <div class="activity-item">
          <p><strong>${project.clientName}</strong> added under ${project.category}</p>
          <small>${formatDate(project.createdAt)} · ${project.status === "completed" ? "Completed" : "Ongoing"}</small>
        </div>
      `,
    )
    .join("");
}

function renderOngoingProjects() {
  const ongoing = state.projects.filter((project) => project.status === "ongoing");

  if (!ongoing.length) {
    ongoingProjectsList.innerHTML = `<div class="empty-state"><h4>No ongoing projects</h4><p>New projects added from the form will appear here with workflow steps and invoice actions.</p></div>`;
    return;
  }

  ongoingProjectsList.innerHTML = ongoing
    .map((project) => {
      const progress = getProgress(project);
      return `
        <article class="project-card">
          <div class="project-card-head">
            <div>
              <p class="eyebrow">${project.category}</p>
              <h4>${project.clientName}</h4>
              <p>${project.companyName}</p>
            </div>
            <span class="status-chip">Ongoing</span>
          </div>

          <div class="summary-row">
            <div class="summary-pill"><span>Net Value</span><strong>${formatSar(netAmount(project))}</strong></div>
            <div class="summary-pill"><span>Start</span><strong>${formatDate(project.startDate)}</strong></div>
            <div class="summary-pill"><span>Handover</span><strong>${formatDate(project.handoverDate)}</strong></div>
            <div class="summary-pill"><span>Progress</span><strong>${progress}%</strong></div>
          </div>

          <div class="progress-shell">
            <div class="progress-bar" style="width:${progress}%"></div>
          </div>

          <div class="pill-row">
            <span class="tag">${project.phone}</span>
            <span class="tag">Discount ${formatSar(project.discount)}</span>
            <span class="tag">Advance ${formatSar(project.advancePaid)}</span>
          </div>

          <div class="action-row">
            <button class="detail-btn" data-view-project="${project.id}" data-type="ongoing">See Details</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderCompletedProjects() {
  const completed = state.projects.filter((project) => project.status === "completed");

  if (!completed.length) {
    completedProjectsList.innerHTML = `<div class="empty-state"><h4>No completed projects yet</h4><p>Once a project is marked complete, its logo, website preview, and visit button will appear here.</p></div>`;
    return;
  }

  completedProjectsList.innerHTML = completed
    .map(
      (project) => `
        <article class="completed-card">
          <div class="completed-top">
            <img src="${project.clientLogo || "./assets/corex-logo.png"}" alt="${project.clientName} logo" class="logo-thumb" />
            <div>
              <p class="eyebrow">${project.category}</p>
              <h4>${project.completionClientName || project.clientName}</h4>
              <p>${project.companyName}</p>
            </div>
          </div>
          <div class="action-row">
            <button class="detail-btn" data-view-project="${project.id}" data-type="completed">See Details</button>
            <button class="delete-btn" data-delete-project="${project.id}">Delete</button>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderChart() {
  const canvas = document.getElementById("comparisonChart");
  const context = canvas.getContext("2d");
  const { currentMonth, lastMonth } = getMonthlyData();

  const width = canvas.width = canvas.clientWidth * window.devicePixelRatio;
  const height = canvas.height = 280 * window.devicePixelRatio;
  context.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);

  const uiWidth = canvas.clientWidth;
  const uiHeight = 280;
  const maxRevenue = Math.max(currentMonth.revenue, lastMonth.revenue, 1);
  const maxProjects = Math.max(currentMonth.projects, lastMonth.projects, 1);
  const baseY = uiHeight - 36;
  const barWidth = 58;
  const groupGap = 90;
  const startX = 70;

  context.font = "14px Manrope";
  context.fillStyle = "rgba(247,240,221,0.76)";
  context.fillText("Revenue (SAR)", 18, 24);
  context.fillStyle = "rgba(184,163,122,0.8)";
  context.fillText("Projects", uiWidth - 82, 24);

  context.strokeStyle = "rgba(214,168,87,0.18)";
  context.lineWidth = 1;
  for (let i = 0; i < 4; i += 1) {
    const y = 42 + i * 52;
    context.beginPath();
    context.moveTo(28, y);
    context.lineTo(uiWidth - 28, y);
    context.stroke();
  }

  [
    { label: "Last Month", x: startX, data: lastMonth },
    { label: "This Month", x: startX + groupGap + 110, data: currentMonth },
  ].forEach((group) => {
    const revenueHeight = (group.data.revenue / maxRevenue) * 138;
    const projectHeight = (group.data.projects / maxProjects) * 92;

    context.fillStyle = "#d6a857";
    roundRect(context, group.x, baseY - revenueHeight, barWidth, revenueHeight, 16);
    context.fill();

    context.fillStyle = "rgba(242,208,141,0.5)";
    roundRect(context, group.x + 76, baseY - projectHeight, barWidth, projectHeight, 16);
    context.fill();

    context.fillStyle = "#f7f0dd";
    context.fillText(group.label, group.x, baseY + 26);
    context.fillText(`${group.data.revenue} SAR`, group.x, baseY - revenueHeight - 10);
    context.fillText(`${group.data.projects}`, group.x + 96, baseY - projectHeight - 10);
  });
}

function openProjectModal(projectId, type) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;

  modalContent.innerHTML = type === "completed" ? buildCompletedMarkup(project) : buildOngoingMarkup(project);
  projectModal.classList.remove("hidden");
}

function buildOngoingMarkup(project) {
  const progress = getProgress(project);
  return `
    <div class="modal-top">
      <div>
        <p class="eyebrow">${project.category}</p>
        <h3>${project.clientName} Project Details</h3>
        <p class="subtle">${project.companyName} · ${project.phone}</p>
      </div>
      <span class="status-chip">Ongoing</span>
    </div>

    <div class="detail-grid">
      <div class="detail-group"><small>Price</small><p>${formatSar(project.price)}</p></div>
      <div class="detail-group"><small>Discount</small><p>${formatSar(project.discount)}</p></div>
      <div class="detail-group"><small>Net Amount</small><p>${formatSar(netAmount(project))}</p></div>
      <div class="detail-group"><small>Advance Paid</small><p>${formatSar(project.advancePaid)}</p></div>
      <div class="detail-group"><small>Start Date</small><p>${formatDate(project.startDate)}</p></div>
      <div class="detail-group"><small>Handover Date</small><p>${formatDate(project.handoverDate)}</p></div>
    </div>

    <div class="progress-head">
      <strong>Workflow Progress</strong>
      <strong>${progress}% Completed</strong>
    </div>
    <div class="progress-shell">
      <div class="progress-bar" style="width:${progress}%"></div>
    </div>

    <div class="step-list">
      ${project.steps
        .map(
          (step, index) => `
            <label class="step-card ${step.done ? "completed" : ""}">
              <input type="checkbox" data-step-checkbox data-project-id="${project.id}" data-step-index="${index}" ${step.done ? "checked" : ""} />
              <div>
                <strong>Step ${index + 1}</strong>
                <p>${step.title}</p>
              </div>
            </label>
          `,
        )
        .join("")}
    </div>

    <div class="detail-group">
      <small>Project Notes</small>
      <p>${project.notes || "No notes added yet."}</p>
    </div>

    <div class="action-row" style="margin-top:1rem">
      <button type="button" class="primary-btn" data-download-invoice="${project.id}">Download Invoice</button>
      <button type="button" class="ghost-btn" data-complete-project="${project.id}">Mark Completed</button>
    </div>
  `;
}

function buildCompletedMarkup(project) {
  return `
    <div class="modal-top">
      <div>
        <p class="eyebrow">${project.category}</p>
        <h3>${project.completionClientName || project.clientName}</h3>
        <p class="subtle">${project.companyName} · Delivered ${formatDate(project.completedAt)}</p>
      </div>
      <span class="status-chip">Completed</span>
    </div>

    <div class="detail-grid">
      <div class="detail-group"><small>Invoice Number</small><p>#${String(project.invoiceNumber || 34).padStart(4, "0")}</p></div>
      <div class="detail-group"><small>Client Phone</small><p>${project.phone}</p></div>
      <div class="detail-group"><small>Website Link</small><p>${project.websiteLink || "Not added"}</p></div>
      <div class="detail-group"><small>Start Date</small><p>${formatDate(project.startDate)}</p></div>
      <div class="detail-group"><small>Handover Date</small><p>${formatDate(project.handoverDate)}</p></div>
      <div class="detail-group"><small>Net Value</small><p>${formatSar(netAmount(project))}</p></div>
    </div>

    <div class="detail-group">
      <small>Project Notes</small>
      <p>${project.notes || "No notes added."}</p>
    </div>

    <div class="preview-images">
      <div>
        <p class="eyebrow">Website Preview</p>
        <img src="${project.websiteImage || "./assets/corex-logo.png"}" alt="${project.clientName} website preview" class="completed-thumb" />
      </div>
      <div>
        <p class="eyebrow">Client Logo</p>
        <img src="${project.clientLogo || "./assets/corex-logo.png"}" alt="${project.clientName} logo" class="completed-thumb" />
      </div>
    </div>

    <div class="action-row" style="margin-top:1rem">
      <button type="button" class="detail-btn" data-download-invoice="${project.id}">Download Invoice</button>
      ${project.websiteLink ? `<button class="visit-btn" data-visit-website="${project.websiteLink}">Visit Website</button>` : ""}
    </div>
  `;
}

function renderCompleteProjectForm(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;

  modalContent.innerHTML = `
    <div class="modal-top">
      <div>
        <p class="eyebrow">Completion Form</p>
        <h3>Finalize ${project.clientName}</h3>
        <p class="subtle">Add the final client details before moving this project to completed.</p>
      </div>
    </div>

    <form id="completeProjectForm" class="completion-box">
      <input type="hidden" name="projectId" value="${project.id}" />
      <div class="completion-grid">
        <label>
          <span>Client Name</span>
          <input type="text" name="clientName" value="${project.clientName}" required />
        </label>
        <label>
          <span>Website Link</span>
          <input type="url" name="websiteLink" placeholder="https://example.com" required />
        </label>
        <label>
          <span>Website Picture</span>
          <input type="file" accept="image/*" data-image-input data-preview-target="websiteImageData" required />
          <input type="hidden" id="websiteImageData" name="websiteImage" />
        </label>
        <label>
          <span>Client Logo</span>
          <input type="file" accept="image/*" data-image-input data-preview-target="clientLogoData" required />
          <input type="hidden" id="clientLogoData" name="clientLogo" />
        </label>
      </div>

      <div class="preview-images">
        <div>
          <p class="eyebrow">Website Preview</p>
          <img src="./assets/corex-logo.png" alt="Website preview" data-preview-image="websiteImageData" class="completed-thumb" />
        </div>
        <div>
          <p class="eyebrow">Client Logo Preview</p>
          <img src="./assets/corex-logo.png" alt="Client logo preview" data-preview-image="clientLogoData" class="completed-thumb" />
        </div>
      </div>

      <div class="action-row">
        <button type="button" id="completeProjectButton" class="primary-btn">Move to Completed</button>
      </div>
    </form>
  `;

  const completionForm = document.getElementById("completeProjectForm");
  const completionButton = document.getElementById("completeProjectButton");

  completionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await handleCompleteProject(completionForm);
  });

  completionButton.addEventListener("click", async () => {
    await handleCompleteProject(completionForm);
  });

  projectModal.classList.remove("hidden");
}

async function handleCompleteProject(form) {
  if (!form.reportValidity()) return;

  const formData = new FormData(form);
  const project = state.projects.find((item) => item.id === formData.get("projectId"));
  if (!project) return;

  const websiteImage = String(formData.get("websiteImage") || "").trim();
  const clientLogo = String(formData.get("clientLogo") || "").trim();
  const websiteLink = String(formData.get("websiteLink") || "").trim();
  const clientName = String(formData.get("clientName") || "").trim();

  if (!clientName || !websiteLink || !websiteImage || !clientLogo) {
    alert("Please fill all completion details and choose both images.");
    return;
  }

  project.status = "completed";
  project.completedAt = new Date().toISOString();
  project.completionClientName = clientName;
  project.websiteLink = websiteLink;
  project.websiteImage = websiteImage;
  project.clientLogo = clientLogo;

  if (!project.invoiceNumber) {
    project.invoiceNumber = state.invoiceCounter;
    state.invoiceCounter += 1;
  }

  if (!persistStateSafely()) return;
  closeModal();
  renderAll();
  setActiveTab("completed");
}

function updateProjectStep(projectId, stepIndex, checked) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  project.steps[stepIndex].done = checked;
  if (!persistStateSafely()) return;
  renderAll();
  openProjectModal(projectId, "ongoing");
}

async function downloadInvoice(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;

  if (!project.invoiceNumber) {
    project.invoiceNumber = state.invoiceCounter;
    state.invoiceCounter += 1;
    if (!persistStateSafely()) return;
    renderAll();
  }

  const logoSrc = await getLogoDataUrl();
  const logoImage = await getImageBytes(logoSrc);
  const pdfBytes = buildInvoicePdf(project, logoImage);
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `corex-invoice-${String(project.invoiceNumber).padStart(4, "0")}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function setActiveTab(tabName) {
  const map = {
    dashboard: "Dashboard Overview",
    "add-project": "Add New Project",
    ongoing: "Ongoing Projects",
    completed: "Completed Projects",
  };

  menuItems.forEach((button) => button.classList.toggle("active", button.dataset.tab === tabName));
  tabPanels.forEach((panel) => panel.classList.toggle("active", panel.id === `tab-${tabName}`));
  tabPanels.forEach((panel) => panel.classList.toggle("hidden", panel.id !== `tab-${tabName}`));
  pageTitle.textContent = map[tabName];
}

function closeModal() {
  projectModal.classList.add("hidden");
}

function deleteCompletedProject(id) {
  const project = state.projects.find((p) => p.id === id);
  if (!project) return;
  const confirmed = window.confirm(`Delete "${project.completionClientName || project.clientName}"? This cannot be undone.`);
  if (!confirmed) return;
  state.projects = state.projects.filter((p) => p.id !== id);
  if (!persistStateSafely()) return;
  renderStats();
  renderActivity();
  renderCompletedProjects();
  renderChart();
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return JSON.parse(saved);
  return {
    invoiceCounter: 34,
    projects: [],
  };
}

function getProgress(project) {
  if (!project.steps?.length) return 0;
  const doneCount = project.steps.filter((step) => step.done).length;
  return Math.round((doneCount / project.steps.length) * 100);
}

function netAmount(project) {
  return Math.max(Number(project.price || 0) - Number(project.discount || 0), 0);
}

function formatSar(value) {
  return `${Number(value || 0).toLocaleString("en-US")} SAR`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getMonthlyData() {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);

  const current = { revenue: 0, projects: 0 };
  const last = { revenue: 0, projects: 0 };

  state.projects.forEach((project) => {
    const target = new Date(project.createdAt);
    const targetMonth = target.getMonth();
    const targetYear = target.getFullYear();
    if (targetMonth === currentMonth && targetYear === currentYear) {
      current.revenue += netAmount(project);
      current.projects += 1;
    }
    if (targetMonth === lastMonthDate.getMonth() && targetYear === lastMonthDate.getFullYear()) {
      last.revenue += netAmount(project);
      last.projects += 1;
    }
  });

  return { currentMonth: current, lastMonth: last };
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

async function fileToOptimizedDataUrl(file, maxWidth = 1200, quality = 0.82) {
  const originalDataUrl = await fileToDataUrl(file);
  const image = await loadImage(originalDataUrl);
  const scale = Math.min(1, maxWidth / image.width);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

function persistStateSafely() {
  try {
    persistState();
    return true;
  } catch (error) {
    console.error("Failed to save COREX data:", error);
    alert("Could not save this project because the browser storage is full. Please use smaller images and try again.");
    return false;
  }
}

async function getLogoDataUrl() {
  const logo = document.querySelector(".brand-logo");
  if (!logo) return "";
  if (logo.src.startsWith("data:")) return logo.src;

  try {
    const response = await fetch(logo.src);
    const blob = await response.blob();
    return await fileToDataUrl(blob);
  } catch {
    return logo.src;
  }
}

async function getImageBytes(source) {
  if (!source) return null;
  try {
    const jpegDataUrl = await imageSourceToJpegDataUrl(source);
    const image = await loadImage(jpegDataUrl);
    const base64 = jpegDataUrl.split(",")[1];
    return {
      width: image.width,
      height: image.height,
      bytes: base64ToUint8Array(base64),
    };
  } catch {
    return null;
  }
}

async function imageSourceToJpegDataUrl(source, maxWidth = 360, quality = 0.9) {
  const image = await loadImage(source);
  const scale = Math.min(1, maxWidth / image.width);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = width;
  canvas.height = height;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function buildInvoicePdf(project, logoImage) {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 48;
  const gold = "0.50 0.41 0.21";
  const muted = "0.43 0.38 0.32";
  const dark = "0.09 0.08 0.06";
  const lightFill = "0.99 0.98 0.96";
  const border = "0.90 0.87 0.81";
  const content = [];
  let y = pageHeight - margin;

  const textLine = (text, x, yPos, size = 12, color = dark) => {
    content.push(`BT /F1 ${size} Tf ${color} rg 1 0 0 1 ${x.toFixed(2)} ${yPos.toFixed(2)} Tm (${escapePdfText(text)}) Tj ET`);
  };

  const line = (x1, y1, x2, y2, color = border, width = 1) => {
    content.push(`${width} w ${color} RG ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  };

  const rect = (x, yPos, width, height, strokeColor = border, fillColor = lightFill) => {
    content.push(`${fillColor} rg ${strokeColor} RG ${x.toFixed(2)} ${yPos.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re B`);
  };

  if (logoImage) {
    const logoWidth = 52;
    const logoHeight = (logoImage.height / logoImage.width) * logoWidth;
    const logoY = y - logoHeight + 10;
    content.push(`q ${logoWidth.toFixed(2)} 0 0 ${logoHeight.toFixed(2)} ${margin.toFixed(2)} ${logoY.toFixed(2)} cm /Im1 Do Q`);
  }

  textLine("COREX", margin + 66, y - 4, 27, dark);
  textLine("Premium Digital Services", margin + 66, y - 24, 11, muted);
  textLine("Project Invoice", margin + 66, y - 39, 11, muted);

  textLine(`Invoice #${String(project.invoiceNumber).padStart(4, "0")}`, pageWidth - 170, y - 4, 13, dark);
  textLine(`Date: ${formatDate(new Date().toISOString())}`, pageWidth - 170, y - 22, 11, muted);
  textLine(`Client: ${project.completionClientName || project.clientName}`, pageWidth - 170, y - 38, 11, muted);

  y -= 70;
  line(margin, y, pageWidth - margin, y);

  y -= 28;
  const cardWidth = (pageWidth - margin * 2 - 16) / 2;
  const cardHeight = 110;
  rect(margin, y - cardHeight, cardWidth, cardHeight);
  rect(margin + cardWidth + 16, y - cardHeight, cardWidth, cardHeight);

  textLine("Bill To", margin + 14, y - 22, 12, gold);
  textLine(project.completionClientName || project.clientName, margin + 14, y - 42, 12, dark);
  textLine(project.companyName, margin + 14, y - 60, 11, muted);
  textLine(project.phone, margin + 14, y - 78, 11, muted);
  textLine(project.email || "Email not provided", margin + 14, y - 96, 11, muted);

  const infoX = margin + cardWidth + 30;
  textLine("Project Info", infoX, y - 22, 12, gold);
  textLine(`Category: ${project.category}`, infoX, y - 42, 11, dark);
  textLine(`Start: ${formatDate(project.startDate)}`, infoX, y - 60, 11, muted);
  textLine(`Handover: ${formatDate(project.handoverDate)}`, infoX, y - 78, 11, muted);
  textLine(`Website: ${project.websiteLink || "Pending"}`, infoX, y - 96, 11, muted);

  y -= cardHeight + 34;
  textLine("Service Summary", margin, y, 12, gold);

  y -= 16;
  const tableX = margin;
  const tableWidth = pageWidth - margin * 2;
  const rowHeights = [24, 38, 28, 28];
  const col1 = 140;
  const col3 = 100;
  const col2 = tableWidth - col1 - col3;
  const tableTotalHeight = rowHeights.reduce((sum, value) => sum + value, 0);
  const tableTop = y;

  rect(tableX, tableTop - rowHeights[0], tableWidth, rowHeights[0], border, "0.96 0.95 0.92");
  line(tableX + col1, tableTop, tableX + col1, tableTop - tableTotalHeight);
  line(tableX + col1 + col2, tableTop, tableX + col1 + col2, tableTop - tableTotalHeight);
  textLine("Service", tableX + 10, tableTop - 16, 10, gold);
  textLine("Details", tableX + col1 + 10, tableTop - 16, 10, gold);
  textLine("Amount", tableX + col1 + col2 + 10, tableTop - 16, 10, gold);

  const rows = [
    [project.category, truncateText(project.notes || "Project execution and delivery services", 58), formatSar(project.price)],
    ["Discount", "Approved discount", `- ${formatSar(project.discount)}`],
    ["Advance Received", "Paid before handover", `- ${formatSar(project.advancePaid)}`],
  ];

  let currentTop = tableTop - rowHeights[0];
  rows.forEach((row, index) => {
    const rowHeight = rowHeights[index + 1];
    rect(tableX, currentTop - rowHeight, tableWidth, rowHeight, border, "1.00 1.00 1.00");
    line(tableX + col1, currentTop, tableX + col1, currentTop - rowHeight);
    line(tableX + col1 + col2, currentTop, tableX + col1 + col2, currentTop - rowHeight);
    textLine(row[0], tableX + 10, currentTop - 18, 10.5, dark);
    textLine(row[1], tableX + col1 + 10, currentTop - 18, 10, muted);
    textLine(row[2], tableX + col1 + col2 + 10, currentTop - 18, 10.5, dark);
    currentTop -= rowHeight;
  });

  y = currentTop - 26;
  const totalsX = pageWidth - margin - 210;
  const totals = [
    ["Subtotal", formatSar(project.price)],
    ["Discount", formatSar(project.discount)],
    ["Net Total", formatSar(netAmount(project))],
  ];

  totals.forEach((item, index) => {
    line(totalsX, y - index * 24, pageWidth - margin, y - index * 24, border, 0.8);
    textLine(item[0], totalsX + 6, y - 16 - index * 24, 11, index === 3 ? gold : muted);
    textLine(item[1], pageWidth - margin - 90, y - 16 - index * 24, 11, index === 3 ? gold : dark);
  });

  const objects = [];
  const addObject = (value) => {
    objects.push(value);
    return objects.length;
  };

  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let imageId = null;
  if (logoImage) {
    imageId = addObject(streamObject(
      `<< /Type /XObject /Subtype /Image /Width ${logoImage.width} /Height ${logoImage.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logoImage.bytes.length} >>`,
      logoImage.bytes,
    ));
  }

  const resources = imageId
    ? `<< /Font << /F1 ${fontId} 0 R >> /XObject << /Im1 ${imageId} 0 R >> >>`
    : `<< /Font << /F1 ${fontId} 0 R >> >>`;

  const contentBytes = new TextEncoder().encode(content.join("\n"));
  const contentId = addObject(streamObject(`<< /Length ${contentBytes.length} >>`, contentBytes));
  const pagesId = objects.length + 2;
  const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources ${resources} /Contents ${contentId} 0 R >>`);
  addObject(`<< /Type /Pages /Count 1 /Kids [${pageId} 0 R] >>`);
  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  return buildPdfBytes(objects, catalogId);
}

function buildPdfBytes(objects, rootId) {
  const encoder = new TextEncoder();
  const chunks = [encoder.encode("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n")];
  const offsets = [0];
  let length = chunks[0].length;

  objects.forEach((object, index) => {
    offsets.push(length);
    const bytes = typeof object === "string" ? encoder.encode(`${index + 1} 0 obj\n${object}\nendobj\n`) : objectToBytes(index + 1, object);
    chunks.push(bytes);
    length += bytes.length;
  });

  const xrefOffset = length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) {
    xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root ${rootId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  chunks.push(encoder.encode(xref));

  return concatUint8Arrays(chunks);
}

function objectToBytes(id, object) {
  const encoder = new TextEncoder();
  const header = encoder.encode(`${id} 0 obj\n${object.dictionary}\nstream\n`);
  const footer = encoder.encode(`\nendstream\nendobj\n`);
  return concatUint8Arrays([header, object.bytes, footer]);
}

function streamObject(dictionary, bytes) {
  return { dictionary, bytes };
}

function concatUint8Arrays(arrays) {
  const totalLength = arrays.reduce((sum, array) => sum + array.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  arrays.forEach((array) => {
    result.set(array, offset);
    offset += array.length;
  });
  return result;
}

function escapePdfText(text) {
  return String(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function truncateText(text, limit) {
  const value = String(text || "");
  return value.length > limit ? `${value.slice(0, limit - 3)}...` : value;
}
