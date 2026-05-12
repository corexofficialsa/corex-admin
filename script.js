const STORAGE_KEY = "corex-admin-data-v1";
const AUTH_KEY = "corex-admin-auth-v1";
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

    if (viewTrigger) openProjectModal(viewTrigger.dataset.viewProject, viewTrigger.dataset.type);
    if (downloadTrigger) downloadInvoice(downloadTrigger.dataset.downloadInvoice);
    if (completeTrigger) renderCompleteProjectForm(completeTrigger.dataset.completeProject);
    if (websiteTrigger) window.open(websiteTrigger.dataset.visitWebsite, "_blank", "noopener");
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

  if (username === LOGIN.username && password === LOGIN.password) {
    localStorage.setItem(AUTH_KEY, "true");
    loginError.textContent = "";
    syncAuth();
    return;
  }

  loginError.textContent = "Invalid username or password.";
}

function handleLogout() {
  localStorage.removeItem(AUTH_KEY);
  loginForm.reset();
  syncAuth();
}

function syncAuth() {
  const isAuthed = localStorage.getItem(AUTH_KEY) === "true";
  loginScreen.classList.toggle("hidden", isAuthed);
  appRoot.classList.toggle("hidden", !isAuthed);
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
    clientName: formData.get("clientName").trim(),
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
  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>COREX Invoice #${String(project.invoiceNumber).padStart(4, "0")}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: #f3efe7;
            color: #16130f;
            font-family: Arial, sans-serif;
          }
          .invoice-sheet {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            padding: 18mm 18mm 14mm;
            background: #fffdfa;
          }
          .invoice-header,
          .invoice-brand,
          .invoice-summary-row,
          .invoice-totals p {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
          }
          .invoice-header {
            padding-bottom: 18px;
            border-bottom: 1px solid #ded5c6;
          }
          .invoice-brand img {
            width: 64px;
            height: 64px;
            object-fit: contain;
          }
          .invoice-brand h1,
          .invoice-brand p,
          .invoice-meta p,
          .invoice-section h2,
          .invoice-table th,
          .invoice-table td,
          .invoice-note,
          .invoice-totals p {
            margin: 0;
          }
          .invoice-brand h1 {
            font-size: 28px;
            line-height: 1;
          }
          .invoice-brand p,
          .invoice-meta p,
          .invoice-note {
            color: #6e6253;
            font-size: 13px;
          }
          .invoice-meta {
            text-align: right;
          }
          .invoice-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 18px;
            margin-top: 24px;
          }
          .invoice-card {
            padding: 16px;
            border: 1px solid #e7dece;
            border-radius: 14px;
            background: #fcfaf6;
          }
          .invoice-section {
            margin-top: 24px;
          }
          .invoice-section h2 {
            font-size: 14px;
            margin-bottom: 10px;
            color: #7f6835;
            letter-spacing: 0.06em;
            text-transform: uppercase;
          }
          .invoice-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          .invoice-table th {
            background: #f6f1e8;
            color: #6b5a37;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }
          .invoice-table th,
          .invoice-table td {
            padding: 12px;
            border-bottom: 1px solid #ece3d4;
            text-align: left;
          }
          .invoice-totals {
            margin-top: 18px;
            margin-left: auto;
            width: 280px;
          }
          .invoice-totals p {
            padding: 8px 0;
            border-bottom: 1px solid #ece3d4;
          }
          .invoice-totals p:last-child {
            color: #7f6835;
            font-weight: 700;
          }
          .invoice-footer {
            margin-top: 26px;
            padding-top: 16px;
            border-top: 1px solid #ded5c6;
          }
          @page {
            size: A4;
            margin: 0;
          }
        </style>
      </head>
      <body>
        <div class="invoice-sheet">
          <div class="invoice-header">
            <div class="invoice-brand">
              <img src="${logoSrc}" alt="COREX logo" />
              <div>
                <h1>COREX</h1>
                <p>Premium Digital Services</p>
                <p>Project Invoice</p>
              </div>
            </div>
            <div class="invoice-meta">
              <p><strong>Invoice:</strong> #${String(project.invoiceNumber).padStart(4, "0")}</p>
              <p><strong>Date:</strong> ${formatDate(new Date().toISOString())}</p>
              <p><strong>Client:</strong> ${project.completionClientName || project.clientName}</p>
            </div>
          </div>

          <div class="invoice-grid">
            <div class="invoice-card">
              <div class="invoice-section">
                <h2>Bill To</h2>
                <p><strong>${project.completionClientName || project.clientName}</strong></p>
                <p>${project.companyName}</p>
                <p>${project.phone}</p>
                <p>${project.email || "Email not provided"}</p>
              </div>
            </div>
            <div class="invoice-card">
              <div class="invoice-section">
                <h2>Project Info</h2>
                <p><strong>Category:</strong> ${project.category}</p>
                <p><strong>Start Date:</strong> ${formatDate(project.startDate)}</p>
                <p><strong>Handover Date:</strong> ${formatDate(project.handoverDate)}</p>
                <p><strong>Website:</strong> ${project.websiteLink || "Pending"}</p>
              </div>
            </div>
          </div>

          <div class="invoice-section">
            <h2>Service Summary</h2>
            <table class="invoice-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Details</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${project.category}</td>
                  <td>${project.notes || "Project execution and delivery services"}</td>
                  <td>${formatSar(project.price)}</td>
                </tr>
                <tr>
                  <td>Discount</td>
                  <td>Approved discount</td>
                  <td>- ${formatSar(project.discount)}</td>
                </tr>
                <tr>
                  <td>Advance Received</td>
                  <td>Paid before handover</td>
                  <td>- ${formatSar(project.advancePaid)}</td>
                </tr>
              </tbody>
            </table>

            <div class="invoice-totals">
              <p><span>Subtotal</span><strong>${formatSar(project.price)}</strong></p>
              <p><span>Discount</span><strong>${formatSar(project.discount)}</strong></p>
              <p><span>Net Total</span><strong>${formatSar(netAmount(project))}</strong></p>
              <p><span>Pending Balance</span><strong>${formatSar(Math.max(netAmount(project) - project.advancePaid, 0))}</strong></p>
            </div>
          </div>

        </div>
      </body>
    </html>
  `;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `corex-invoice-${String(project.invoiceNumber).padStart(4, "0")}.html`;
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
