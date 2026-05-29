function deleteMonthBtn(month){
  return `
    <button
      class="delete-month-btn"
      onclick="event.stopPropagation(); deleteMonth('${month}')"
      title="Delete Entire Month">
      🗑
    </button>
  `;
}

function parseMonthYear(monthString){
  const [monthName, year] = monthString.split(" ");
  const monthIndex = new Date(Date.parse(monthName +" 1, 2024")).getMonth();
  return new Date(Number(year), monthIndex, 1);
}

// ── State ──
let expenses       = JSON.parse(localStorage.getItem("expenses"))  || [];
let salaries       = JSON.parse(localStorage.getItem("salaries"))  || {};
let editingId      = null;
let formOpen       = false;
let menuOpenForId  = null;
let openSectionIds = new Set(); // Keeps track of open sections across renders

// ── Persistence ──
function saveExpenses(){ localStorage.setItem("expenses", JSON.stringify(expenses)); }
function saveSalaries(){ localStorage.setItem("salaries", JSON.stringify(salaries)); }

// ── Toggle Add Expense form ──
function toggleAddExpense(){
  const container = document.getElementById("expenseFormContainer");
  formOpen = !formOpen;
  container.classList.toggle("hidden", !formOpen);
  document.getElementById("addBtnIcon").textContent = formOpen ? "−" : "+";
  document.getElementById("addExpenseBtn").style.borderRadius = formOpen ? "16px 16px 0 0" : "16px";
}

// ── Toast ──
function showToast(){
  const t = document.getElementById("successToast");
  t.classList.remove("hidden");
  setTimeout(() => {
    t.style.opacity = "0";
    setTimeout(() => { t.classList.add("hidden"); t.style.opacity = "1"; }, 350);
  }, 1600);
}

// ── Date input colour ──
const dateInput = document.getElementById("date");
if(dateInput) {
  dateInput.addEventListener("change", () => {
    dateInput.classList.toggle("has-value", !!dateInput.value);
  });
}

// ── Group & sort months ──
function groupByMonth(data){
  const g = {};
  
  // Initialize any months that have a salary attached so they remain visible even if empty
  Object.keys(salaries).forEach(month => {
    g[month] = [];
  });

  data.forEach(e => {
    const d     = new Date(e.date + "T00:00:00");
    const month = d.toLocaleString("default", { month:"long", year:"numeric" });
    if(!g[month]) g[month] = [];
    g[month].push(e);
  });
  return g;
}

function sortedMonths(grouped){
  return Object.keys(grouped).sort((a,b) => {
    const [am, ay] = a.split(" ");
    const [bm, by] = b.split(" ");
    return new Date(`${by}-${new Date(Date.parse(bm + " 1, 2024")).getMonth()+1}-01`)
      - new Date(`${ay}-${new Date(Date.parse(am + " 1, 2024")).getMonth()+1}-01`);
  });
}

function fmt(dateStr){
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day:"2-digit", month:"short" });
}

// ── Table ──
function createTable(data){
  if(!data.length) return `<p class="no-expenses">No expenses yet</p>`;

  const rows = data.map(e => `
    <tr id="row-${e.id}">
      <td class="td-amount">₹${Number(e.amount).toLocaleString()}</td>
      <td class="td-date">${fmt(e.date)}</td>
      <td class="td-note" title="${e.note || ''}">${e.note || '—'}</td>
      <td class="td-options">
        <button class="options-trigger" onclick="toggleMenu('${e.id}', this, event)" aria-label="Options">⋯</button>
      </td>
    </tr>
    <tr id="menu-row-${e.id}" class="${menuOpenForId === e.id ? '' : 'hidden'}">
      <td colspan="4" class="inline-menu-cell">
        <div class="inline-menu">
          <button class="opt-edit" onclick="editExpense('${e.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
          <button class="opt-delete" onclick="deleteExpense('${e.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
            Delete
          </button>
        </div>
      </td>
    </tr>
  `).join("");

  return `
    <table class="expense-table">
      <thead>
        <tr>
          <th>Amount</th>
          <th>Date</th>
          <th>Note</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function toggleMenu(id, btn, event){
  event.stopPropagation();
  if(menuOpenForId === id){
    menuOpenForId = null;
  } else {
    menuOpenForId = id;
  }
  document.querySelectorAll("tr[id^='menu-row-']").forEach(row => {
    const rowId = row.id.replace("menu-row-", "");
    row.classList.toggle("hidden", rowId !== menuOpenForId);
  });
}

// ── Salary modal ──
let salaryTargetMonth = null;

function openSalaryModal(month, event){
  event.stopPropagation();
  salaryTargetMonth = month;
  document.getElementById("modalMonthLabel").textContent = month;
  document.getElementById("salaryInput").value = salaries[month] || "";
  document.getElementById("salaryModal").classList.remove("hidden");
}

function closeSalaryModal(){
  document.getElementById("salaryModal").classList.add("hidden");
  salaryTargetMonth = null;
}

function saveSalary(){
  const val = parseFloat(document.getElementById("salaryInput").value);
  if(isNaN(val) || val <= 0){ alert("Enter a valid salary."); return; }
  salaries[salaryTargetMonth] = val;
  saveSalaries();
  closeSalaryModal();
  renderExpenses();
}

// ── Render ──
function renderExpenses(autoExpandMonth, autoExpandSection){
  const container = document.getElementById("monthlyContainer");

  if(autoExpandMonth){
    const mId = autoExpandMonth.replace(/\s/g,"");
    openSectionIds.add(mId);
    if(autoExpandSection){
      openSectionIds.add(mId + "-" + autoExpandSection);
    }
  }

  container.innerHTML = "";

  const grouped = groupByMonth(expenses);
  const months  = sortedMonths(grouped);

  months.forEach(month => {
    const all  = grouped[month];
    const main = all.filter(e => e.person === "Main");
    const self = all.filter(e => e.person === "Self");
    const mainTotal  = main.reduce((s,e) => s + Number(e.amount), 0);
    const selfTotal  = self.reduce((s,e) => s + Number(e.amount), 0);
    const grandTotal = mainTotal + selfTotal;

    const monthId = month.replace(/\s/g, "");
    const monthShouldOpen = openSectionIds.has(monthId);
    const mainOpen = openSectionIds.has(monthId + "-main");
    const selfOpen = openSectionIds.has(monthId + "-self");

    const hasSalary = salaries[month] !== undefined;
    const salaryVal = hasSalary ? salaries[month] : 0;
    const remaining = salaryVal - grandTotal;

    const remainingHTML = hasSalary ? `
      <div class="total-row remaining-row">
        <span>Remaining</span>
        <span class="${remaining < 0 ? 'neg' : 'pos'}">
          ${remaining < 0 ? '−' : ''}₹${Math.abs(remaining).toLocaleString()}
        </span>
      </div>
    ` : "";

    const card = document.createElement("div");
    card.className = "month-card";
    const monthBodyClass = monthShouldOpen ? "" : "hidden";
    const chevText = monthShouldOpen ? "▴" : "▾";
    const chevClass = monthShouldOpen ? "chevron open" : "chevron";

    card.innerHTML = `
      <div class="month-header" onclick="toggleSection('${monthId}')">
        <div class="month-header-left">
          <span class="month-title">
            ${month} ${deleteMonthBtn(month)}
          </span>
          <button class="salary-tag ${hasSalary ? 'salary-tag-set' : 'salary-tag-add'}" onclick="openSalaryModal('${month}', event)">
            ${hasSalary ? '✎ Salary' : '+ Salary'}
          </button>
        </div>
        <span class="${chevClass}" id="chev-${monthId}">${chevText}</span>
      </div>
      <div id="${monthId}" class="${monthBodyClass}">
        <div class="summary-block">
          <div class="total-row"><span>Main</span><span>₹${mainTotal.toLocaleString()}</span></div>
          <div class="total-row"><span>Self</span><span>₹${selfTotal.toLocaleString()}</span></div>
          ${remainingHTML}
        </div>
        <div class="section-header" onclick="toggleSection('${monthId}-main', event)">
          <span>Main Expenses</span>
          <span class="${mainOpen ? 'chevron open' : 'chevron'}" id="chev-${monthId}-main">${mainOpen ? '▴' : '▾'}</span>
        </div>
        <div id="${monthId}-main" class="${mainOpen ? '' : 'hidden'}">
          ${createTable(main)}
        </div>
        <div class="section-header" onclick="toggleSection('${monthId}-self', event)">
          <span>Self Expenses</span>
          <span class="${selfOpen ? 'chevron open' : 'chevron'}" id="chev-${monthId}-self">${selfOpen ? '▴' : '▾'}</span>
        </div>
        <div id="${monthId}-self" class="${selfOpen ? '' : 'hidden'}">
          ${createTable(self)}
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function toggleSection(id, event){
  if(event) event.stopPropagation();
  const el = document.getElementById(id);
  if(!el) return;
  
  if(openSectionIds.has(id)){
    openSectionIds.delete(id);
    el.classList.add("hidden");
    const chev = document.getElementById("chev-" + id);
    if(chev) { chev.textContent = "▾"; chev.classList.remove("open"); }
  } else {
    openSectionIds.add(id);
    el.classList.remove("hidden");
    const chev = document.getElementById("chev-" + id);
    if(chev) { chev.textContent = "▴"; chev.classList.add("open"); }
  }
}

// ── Submit Form ──
document.getElementById("expenseForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const amount = parseFloat(document.getElementById("amount").value);
  const date = document.getElementById("date").value;
  const person = document.getElementById("person").value;
  const note = document.getElementById("note").value.trim();

  if(editingId) {
    expenses = expenses.map(exp => exp.id === editingId ? { id: editingId, amount, date, person, note } : exp);
    editingId = null;
    document.querySelector(".save-btn").textContent = "Save Expense";
  } else {
    const newExp = { id: Date.now().toString(), amount, date, person, note };
    expenses.push(newExp);
  }

  saveExpenses();
  const d = new Date(date + "T00:00:00");
  const monthName = d.toLocaleString("default", { month: "long", year: "numeric" });
  const section = person === "Main" ? "main" : "self";
  
  menuOpenForId = null;
  renderExpenses(monthName, section);
  e.target.reset();
  dateInput.classList.remove("has-value");
  showToast();
  document.getElementById("expenseFormContainer").classList.add("hidden");
  formOpen = false;
  document.getElementById("addBtnIcon").textContent = "+";
  document.getElementById("addExpenseBtn").style.borderRadius = "16px";
});

function editExpense(id){
  const exp = expenses.find(e => e.id === id);
  if(!exp) return;
  editingId = id;
  document.getElementById("amount").value = exp.amount;
  document.getElementById("date").value = exp.date;
  document.getElementById("date").classList.add("has-value");
  document.getElementById("person").value = exp.person;
  document.getElementById("note").value = exp.note || "";
  
  document.querySelector(".save-btn").textContent = "Update Expense";
  if(!formOpen) toggleAddExpense();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteExpense(id){
  if(!confirm("Delete this expense?")) return;
  expenses = expenses.filter(e => e.id !== id);
  saveExpenses();
  renderExpenses();
}

function deleteMonth(month){
  const confirmDelete = confirm(`Delete all expenses for ${month}?`);
  if(!confirmDelete) return;

  expenses = expenses.filter(exp => {
    const expDate = new Date(exp.date + "T00:00:00");
    const expMonth = expDate.toLocaleString("default", { month:"long", year:"numeric" });
    return expMonth !== month;
  });

  delete salaries[month];
  localStorage.setItem("expenses", JSON.stringify(expenses));
  localStorage.setItem("salaries", JSON.stringify(salaries));

  const mId = month.replace(/\s/g, "");
  openSectionIds.delete(mId);
  openSectionIds.delete(mId + "-main");
  openSectionIds.delete(mId + "-self");

  renderExpenses();
}

function triggerImport(){
  document.getElementById("importFile").click();
}

function importData(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    try{
      const data = JSON.parse(e.target.result);
      if(data.expenses && Array.isArray(data.expenses)){
        const existingIds = new Set(expenses.map(x => x.id));
        const newOnes = data.expenses.filter(x => !existingIds.has(x.id));
        expenses = [...expenses, ...newOnes];
      }
      if(data.salaries && typeof data.salaries === "object"){
        salaries = { ...salaries, ...data.salaries };
      }
      saveExpenses();
      saveSalaries();
      renderExpenses();
      alert(`✅ Imported ${newOnes.length} new expense(s)!`);
    } catch(err){
      alert("Failed to read file. Make sure it's a valid backup JSON.");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

// ── Expand / Collapse All ──
function expandAll() {
  const grouped = groupByMonth(expenses);
  Object.keys(grouped).forEach(month => {
    const mId = month.replace(/\s/g,"");
    openSectionIds.add(mId);
    openSectionIds.add(mId + "-main");
    openSectionIds.add(mId + "-self");
  });
  renderExpenses();
}

function collapseAll() {
  openSectionIds.clear();
  renderExpenses();
}

// ── Init ──
renderExpenses();