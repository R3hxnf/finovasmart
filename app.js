/* ═══════════════════════════════════════════════════════════════════════════
   FINOVA — Application Logic
   Supabase + Stock APIs + Charts + Full CRUD
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

/* ─── CONFIG ──────────────────────────────────────────────────────────────── */
const CONFIG = {
  // ⚠️  Replace with your Supabase project URL and anon key
  SUPABASE_URL:  'https://YOUR_PROJECT.supabase.co',
  SUPABASE_KEY:  'YOUR_ANON_KEY',

  // ⚠️  Replace with your API keys
  FINNHUB_KEY:        'YOUR_FINNHUB_KEY',
  ALPHA_VANTAGE_KEY:  'YOUR_ALPHA_VANTAGE_KEY',
  TWELVE_DATA_KEY:    'YOUR_TWELVE_DATA_KEY',

  CURRENCY:      'LKR',
  REFRESH_INTERVAL: 60_000, // 1 minute
};

/* ─── DEMO DATA (shown when no Supabase configured) ──────────────────────── */
const DEMO = {
  user: { id: 'demo', email: 'demo@finova.app', user_metadata: { full_name: 'Alex Johnson' } },
  banks: [
    { id: 1, bank_name: 'Commercial Bank', account_name: 'Savings Account', balance: 1_250_000, currency: 'LKR' },
    { id: 2, bank_name: "People's Bank",   account_name: 'Current Account',  balance: 480_500,  currency: 'LKR' },
    { id: 3, bank_name: 'HNB',             account_name: 'FD Savings',       balance: 325_000,  currency: 'LKR' },
  ],
  cards: [
    { id: 1, card_name: 'Visa Infinite',  bank: 'Commercial Bank', credit_limit: 500_000, outstanding_balance: 127_000, due_date: '2025-08-05' },
    { id: 2, card_name: 'Mastercard Gold', bank: 'HNB',            credit_limit: 300_000, outstanding_balance: 45_500,  due_date: '2025-08-12' },
  ],
  fixed_deposits: [
    { id: 1, bank: 'Commercial Bank', principal: 2_000_000, interest_rate: 11.5, start_date: '2024-01-15', maturity_date: '2025-01-15' },
    { id: 2, bank: "Sampath Bank",    principal: 1_500_000, interest_rate: 12.0, start_date: '2024-06-01', maturity_date: '2025-06-01' },
  ],
  funds: [
    { id: 1, fund_name: 'Ceybank Unit Trust', invested_amount: 500_000, current_value: 578_250, purchase_date: '2023-09-01' },
    { id: 2, fund_name: 'Eagle NDB Fund',     invested_amount: 300_000, current_value: 342_000, purchase_date: '2024-02-15' },
  ],
  stocks: [
    { id: 1, symbol: 'COMB.N0000', company_name: 'Commercial Bank',   shares: 1000, purchase_price: 92.50,  purchase_date: '2023-05-10', current_price: 98.60 },
    { id: 2, symbol: 'DIAL.N0000', company_name: 'Dialog Axiata',     shares: 5000, purchase_price: 12.30,  purchase_date: '2023-08-22', current_price: 11.50 },
    { id: 3, symbol: 'JKH.N0000',  company_name: 'John Keells',       shares: 200,  purchase_price: 205.00, purchase_date: '2024-01-15', current_price: 231.75 },
    { id: 4, symbol: 'AAPL',       company_name: 'Apple Inc.',        shares: 10,   purchase_price: 178.50, purchase_date: '2023-11-20', current_price: 195.80 },
    { id: 5, symbol: 'TSLA',       company_name: 'Tesla Inc.',        shares: 5,    purchase_price: 248.00, purchase_date: '2024-03-01', current_price: 185.30 },
  ],
  expenses: (() => {
    const cats = ['Food','Transport','Utilities','Entertainment','Healthcare','Shopping','Others'];
    const descs = {
      Food: ['Dinner at Ministry', 'Lunch box', 'Grocery - Keells', 'Coffee'],
      Transport: ['Uber ride', 'PickMe', 'Fuel', 'Bus fare'],
      Utilities: ['Electricity bill', 'Internet - SLT', 'Water bill'],
      Entertainment: ['Netflix', 'Movie tickets', 'Spotify'],
      Healthcare: ['Pharmacy', 'Doctor visit', 'Gym'],
      Shopping: ['Amazon order', 'Clothing', 'Electronics'],
      Others: ['Donation', 'Miscellaneous'],
    };
    const items = [];
    for (let i = 0; i < 30; i++) {
      const cat = cats[Math.floor(Math.random() * cats.length)];
      const d = new Date(); d.setDate(d.getDate() - Math.floor(Math.random() * 30));
      items.push({
        id: i + 1,
        date: d.toISOString().split('T')[0],
        category: cat,
        description: descs[cat][Math.floor(Math.random() * descs[cat].length)],
        amount: Math.floor(Math.random() * 8000) + 200,
      });
    }
    return items.sort((a, b) => b.date.localeCompare(a.date));
  })(),
  budgets: [
    { id: 1, category: 'Food',          budget_limit: 30000 },
    { id: 2, category: 'Transport',     budget_limit: 15000 },
    { id: 3, category: 'Entertainment', budget_limit: 10000 },
    { id: 4, category: 'Shopping',      budget_limit: 20000 },
    { id: 5, category: 'Healthcare',    budget_limit: 8000  },
  ],
};

/* ─── STATE ────────────────────────────────────────────────────────────────── */
const STATE = {
  user:     null,
  isDemo:   false,
  theme:    localStorage.getItem('finova-theme') || 'dark',
  data:     { banks: [], cards: [], fixed_deposits: [], funds: [], stocks: [], expenses: [], budgets: [] },
  charts:   {},
  refreshTimer: null,
};

/* ─── SUPABASE CLIENT ─────────────────────────────────────────────────────── */
// Detect whether real credentials have been provided
const SUPABASE_CONFIGURED =
  CONFIG.SUPABASE_URL !== 'https://YOUR_PROJECT.supabase.co' &&
  CONFIG.SUPABASE_KEY !== 'YOUR_ANON_KEY' &&
  CONFIG.SUPABASE_URL.startsWith('https://') &&
  CONFIG.SUPABASE_KEY.length > 20;

let supabase = null;
if (SUPABASE_CONFIGURED) {
  try {
    supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
  } catch (e) {
    console.warn('Supabase init failed:', e);
  }
}

/* ─── UTILITIES ────────────────────────────────────────────────────────────── */
const fmt = (n, currency = CONFIG.CURRENCY) =>
  new Intl.NumberFormat('en-LK', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);

const fmtDecimal = (n) =>
  new Intl.NumberFormat('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const fmtPct = (n) => `${n >= 0 ? '+' : ''}${fmtDecimal(n)}%`;

const el = (id) => document.getElementById(id);
const setText = (id, v) => { const e = el(id); if (e) e.textContent = v; };
const setHTML = (id, v) => { const e = el(id); if (e) e.innerHTML = v; };

function toast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  el('toast-container').appendChild(t);
  setTimeout(() => { t.classList.add('exit'); setTimeout(() => t.remove(), 300); }, 3500);
}

function daysUntil(dateStr) {
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function calcFDMaturity(principal, rate, startDate, maturityDate) {
  const years = (new Date(maturityDate) - new Date(startDate)) / (365.25 * 24 * 60 * 60 * 1000);
  return principal * Math.pow(1 + (rate / 100) / 1, 1 * years);
}

/* ─── THEME ────────────────────────────────────────────────────────────────── */
function setTheme(t) {
  STATE.theme = t;
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('finova-theme', t);
  const icon = t === 'dark' ? '☀' : '☽';
  document.querySelectorAll('#theme-toggle, #theme-toggle-mobile').forEach(b => b.textContent = icon);
  // Update chart colors
  Object.values(STATE.charts).forEach(c => {
    if (c && c.options) {
      c.options.plugins.legend.labels.color = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
      c.update();
    }
  });
}
setTheme(STATE.theme);

document.querySelectorAll('#theme-toggle, #theme-toggle-mobile').forEach(btn =>
  btn.addEventListener('click', () => setTheme(STATE.theme === 'dark' ? 'light' : 'dark'))
);

/* ─── AUTH ─────────────────────────────────────────────────────────────────── */

// Helpers
function setAuthMsg(msg, isError = false) {
  const el2 = el('auth-message');
  el2.textContent = msg;
  el2.style.color = isError ? 'var(--accent-red)' : 'var(--accent-green)';
}

function setBtnLoading(btnId, loading, originalText) {
  const btn = el(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? '···' : originalText;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Tab switching
document.querySelectorAll('.auth-tab').forEach(tab =>
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab, .auth-form').forEach(e => e.classList.remove('active'));
    tab.classList.add('active');
    el(`auth-${tab.dataset.tab}`).classList.add('active');
    setAuthMsg('');
  })
);

// ── LOGIN ──
el('btn-login')?.addEventListener('click', async () => {
  const email = el('login-email').value.trim();
  const pass  = el('login-password').value;

  if (!email || !pass) { setAuthMsg('Please enter your email and password.', true); return; }
  if (!validateEmail(email)) { setAuthMsg('Please enter a valid email address.', true); return; }

  if (!supabase) {
    // No Supabase — fall into demo mode with the entered name
    setAuthMsg('No backend configured. Launching demo mode…');
    setTimeout(() => {
      STATE.isDemo = true;
      STATE.user   = { id: 'demo', email, user_metadata: { full_name: email.split('@')[0] } };
      STATE.data   = JSON.parse(JSON.stringify(DEMO));
      STATE.data.user = STATE.user;
      launchApp();
    }, 600);
    return;
  }

  setBtnLoading('btn-login', true, 'Sign In');
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) { setAuthMsg(error.message, true); return; }
    toast('Signed in!', 'success');
  } catch (e) {
    setAuthMsg('Connection failed. Check your Supabase config or use Demo mode.', true);
  } finally {
    setBtnLoading('btn-login', false, 'Sign In');
  }
});

// ── SIGNUP ──
el('btn-signup')?.addEventListener('click', async () => {
  const name  = el('signup-name').value.trim();
  const email = el('signup-email').value.trim();
  const pass  = el('signup-password').value;

  // Validation
  if (!name)  { setAuthMsg('Please enter your full name.', true); return; }
  if (!email) { setAuthMsg('Please enter your email address.', true); return; }
  if (!validateEmail(email)) { setAuthMsg('Please enter a valid email address.', true); return; }
  if (!pass || pass.length < 8) { setAuthMsg('Password must be at least 8 characters.', true); return; }

  if (!supabase) {
    // No Supabase configured — create a local account with empty (fresh) data
    setAuthMsg('Account created! Launching your personal dashboard…');
    setTimeout(() => {
      STATE.isDemo = true;
      STATE.user   = { id: 'local-' + Date.now(), email, user_metadata: { full_name: name } };
      // Start with empty data for a brand-new account
      STATE.data   = { banks: [], cards: [], fixed_deposits: [], funds: [], stocks: [], expenses: [], budgets: [] };
      launchApp();
    }, 800);
    return;
  }

  setBtnLoading('btn-signup', true, 'Create Account');
  setAuthMsg('');
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: { data: { full_name: name } },
    });

    if (error) {
      setAuthMsg(error.message, true);
      return;
    }

    // If Supabase email confirmation is disabled, user is signed in immediately
    if (data?.session) {
      toast('Account created!', 'success');
      // onAuthStateChange will fire and call launchApp
    } else {
      setAuthMsg('✅ Account created! Check your email to confirm, then sign in.');
      // Switch to login tab after short delay
      setTimeout(() => {
        document.querySelector('.auth-tab[data-tab="login"]')?.click();
        el('login-email').value = email;
      }, 2000);
    }
  } catch (e) {
    setAuthMsg('Connection failed. Check your Supabase config or use Demo mode.', true);
  } finally {
    setBtnLoading('btn-signup', false, 'Create Account');
  }
});

// ── DEMO ──
el('btn-demo')?.addEventListener('click', () => {
  STATE.isDemo = true;
  STATE.user   = DEMO.user;
  STATE.data   = JSON.parse(JSON.stringify(DEMO)); // deep clone so mutations don't affect original
  launchApp();
});

el('btn-logout')?.addEventListener('click', async () => {
  if (!STATE.isDemo && supabase) await supabase.auth.signOut();
  location.reload();
});

// Supabase auth state change (real accounts only)
if (supabase) {
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user && !STATE.user) {
      STATE.user = session.user;
      try {
        await loadAllData();
      } catch (e) {
        console.error('Data load failed:', e);
        STATE.data = { banks: [], cards: [], fixed_deposits: [], funds: [], stocks: [], expenses: [], budgets: [] };
      }
      launchApp();
    }
  });
}

/* ─── APP LAUNCH ───────────────────────────────────────────────────────────── */
function launchApp() {
  el('auth-overlay').classList.add('hidden');
  el('app').classList.remove('hidden');

  // Set user display info
  const name = STATE.user?.user_metadata?.full_name || STATE.user?.email?.split('@')[0] || 'User';
  setText('user-name', name);
  setText('greeting-name', name.split(' ')[0]);
  el('user-avatar').textContent = name[0].toUpperCase();

  renderAll();
  if (!STATE.isDemo) startAutoRefresh();
}

/* ─── NAVIGATION ───────────────────────────────────────────────────────────── */
const SECTION_TITLES = {
  dashboard: 'Overview', banks: 'Bank Accounts', cards: 'Cards',
  stocks: 'Stocks', 'fixed-deposits': 'Fixed Deposits', funds: 'Funds',
  expenses: 'Expenses', budgets: 'Budgets', networth: 'Net Worth',
};

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const sec = item.dataset.section;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    el(`section-${sec}`)?.classList.add('active');
    setText('topbar-title', SECTION_TITLES[sec] || sec);
    closeSidebar();
  });
});

// Mobile sidebar
el('hamburger').addEventListener('click', openSidebar);
el('sidebar-close').addEventListener('click', closeSidebar);

let backdrop = null;
function openSidebar() {
  el('sidebar').classList.add('open');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', closeSidebar);
  }
  backdrop.classList.add('show');
}
function closeSidebar() {
  el('sidebar').classList.remove('open');
  backdrop?.classList.remove('show');
}

/* ─── DATA LOADING (Supabase) ───────────────────────────────────────────────── */
async function loadAllData() {
  const uid = STATE.user.id;
  const tables = ['bank_accounts', 'cards', 'fixed_deposits', 'funds', 'stocks', 'expenses', 'budgets'];
  const results = await Promise.all(tables.map(t =>
    supabase.from(t).select('*').eq('user_id', uid).order('created_at', { ascending: false })
  ));
  STATE.data = {
    banks:           results[0].data || [],
    cards:           results[1].data || [],
    fixed_deposits:  results[2].data || [],
    funds:           results[3].data || [],
    stocks:          results[4].data || [],
    expenses:        results[5].data || [],
    budgets:         results[6].data || [],
  };
}

/* ─── STOCK PRICE FETCHING ──────────────────────────────────────────────────── */
async function fetchStockPrice(symbol) {
  // Try Finnhub first (for international stocks)
  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${CONFIG.FINNHUB_KEY}`;
    const res = await fetch(url);
    const d   = await res.json();
    if (d.c && d.c > 0) return d.c;
  } catch (_) {}

  // Fallback: Twelve Data
  try {
    const url = `https://api.twelvedata.com/price?symbol=${symbol}&apikey=${CONFIG.TWELVE_DATA_KEY}`;
    const res = await fetch(url);
    const d   = await res.json();
    if (d.price) return parseFloat(d.price);
  } catch (_) {}

  // CSE stocks: return stored price (CSE has no free real-time API)
  return null;
}

async function refreshStockPrices() {
  const stocks = STATE.data.stocks;
  if (!stocks.length) return;

  await Promise.all(stocks.map(async (s) => {
    const price = await fetchStockPrice(s.symbol);
    if (price !== null) s.current_price = price;
  }));

  renderStocks();
  renderDashboard();
}

function startAutoRefresh() {
  STATE.refreshTimer = setInterval(refreshStockPrices, CONFIG.REFRESH_INTERVAL);
}

/* ─── RENDER ALL ────────────────────────────────────────────────────────────── */
function renderAll() {
  renderDashboard();
  renderBanks();
  renderCards();
  renderStocks();
  renderFDs();
  renderFunds();
  renderExpenses();
  renderBudgets();
  renderNetWorth();
}

/* ─── CHART HELPERS ─────────────────────────────────────────────────────────── */
const chartDefaults = () => ({
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      labels: {
        color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary') || '#888',
        font: { family: 'DM Sans', size: 12 },
        boxWidth: 12, boxHeight: 12, borderRadius: 4,
      },
    },
    tooltip: {
      backgroundColor: '#1a1a24',
      borderColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      titleFont: { family: 'DM Sans', weight: '600' },
      bodyFont:  { family: 'DM Mono' },
      padding: 12,
    },
  },
});

function makeChart(id, config) {
  if (STATE.charts[id]) STATE.charts[id].destroy();
  const ctx = el(id);
  if (!ctx) return;
  STATE.charts[id] = new Chart(ctx, { ...config });
  return STATE.charts[id];
}

const PALETTE = [
  '#3b82f6','#a78bfa','#2dd4bf','#4ade80','#fbbf24',
  '#f87171','#60a5fa','#c084fc','#34d399','#fb923c',
];

/* ─── DASHBOARD ─────────────────────────────────────────────────────────────── */
function renderDashboard() {
  const { banks, cards, fixed_deposits, funds, stocks, expenses } = STATE.data;

  const bankTotal   = banks.reduce((s, b) => s + (b.balance || 0), 0);
  const cardDebt    = cards.reduce((s, c) => s + (c.outstanding_balance || 0), 0);
  const fdTotal     = fixed_deposits.reduce((s, f) => s + calcFDMaturity(f.principal, f.interest_rate, f.start_date, f.maturity_date), 0);
  const fundTotal   = funds.reduce((s, f) => s + (f.current_value || f.invested_amount || 0), 0);
  const stockTotal  = stocks.reduce((s, s2) => s + ((s2.current_price || s2.purchase_price) * s2.shares), 0);
  const assets      = bankTotal + fdTotal + fundTotal + stockTotal;
  const netWorth    = assets - cardDebt;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthExp   = expenses.filter(e => new Date(e.date) >= monthStart)
                             .reduce((s, e) => s + e.amount, 0);

  setText('dash-networth', fmt(netWorth));
  setText('dash-banks',    fmt(bankTotal));
  setText('dash-stocks',   fmt(stockTotal));
  setText('dash-fds',      fmt(fdTotal));
  setText('dash-expenses', fmt(monthExp));

  // Mini net worth sparkline
  const sparkData = generateTrendData(netWorth, 8);
  makeChart('chart-networth-mini', {
    type: 'line',
    data: {
      labels: sparkData.map((_,i) => i),
      datasets: [{ data: sparkData, borderColor: '#3b82f6', borderWidth: 2, pointRadius: 0,
        tension: 0.4, fill: true,
        backgroundColor: (ctx) => {
          const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 80);
          g.addColorStop(0, 'rgba(59,130,246,0.3)'); g.addColorStop(1, 'rgba(59,130,246,0)');
          return g;
        }
      }]
    },
    options: { ...chartDefaults(), plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { display: false }, y: { display: false } },
      animation: { duration: 1000 },
    }
  });

  // Asset allocation doughnut
  makeChart('chart-allocation', {
    type: 'doughnut',
    data: {
      labels: ['Banks', 'Stocks', 'Fixed Deposits', 'Funds'],
      datasets: [{ data: [bankTotal, stockTotal, fdTotal, fundTotal],
        backgroundColor: PALETTE.slice(0, 4),
        borderWidth: 0, hoverOffset: 6,
      }]
    },
    options: {
      ...chartDefaults(),
      cutout: '70%',
      plugins: { ...chartDefaults().plugins, legend: { ...chartDefaults().plugins.legend, position: 'bottom' } }
    }
  });

  // Monthly expenses bar
  const monthlyData = getLast6MonthsExpenses(expenses);
  makeChart('chart-expenses-bar', {
    type: 'bar',
    data: {
      labels: monthlyData.labels,
      datasets: [{ label: 'Expenses', data: monthlyData.values,
        backgroundColor: 'rgba(59,130,246,0.7)',
        borderRadius: 8, borderSkipped: false,
      }]
    },
    options: {
      ...chartDefaults(),
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#666' } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#666', callback: v => fmt(v) } },
      },
    }
  });

  // Net worth trend
  const trendData = generateTrendData(netWorth, 12);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const now2 = new Date();
  const trendLabels = Array.from({length: 12}, (_,i) => {
    const m = (now2.getMonth() - 11 + i + 12) % 12;
    return months[m];
  });
  makeChart('chart-networth-trend', {
    type: 'line',
    data: {
      labels: trendLabels,
      datasets: [{ label: 'Net Worth', data: trendData,
        borderColor: '#3b82f6', borderWidth: 2.5, pointRadius: 3,
        pointBackgroundColor: '#3b82f6', tension: 0.4, fill: true,
        backgroundColor: (ctx) => {
          const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 300);
          g.addColorStop(0, 'rgba(59,130,246,0.2)'); g.addColorStop(1, 'rgba(59,130,246,0)');
          return g;
        }
      }]
    },
    options: {
      ...chartDefaults(),
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#666' } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#666', callback: v => fmt(v) } },
      },
    }
  });

  // AI Insights
  generateInsights(bankTotal, stockTotal, fdTotal, fundTotal, cardDebt, monthExp);
}

function generateTrendData(current, points) {
  const data = [];
  for (let i = 0; i < points; i++) {
    const factor = (i + 1) / points;
    const noise  = (Math.random() - 0.45) * 0.05;
    data.push(Math.round(current * factor * (1 + noise)));
  }
  return data;
}

function getLast6MonthsExpenses(expenses) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const now    = new Date();
  const labels = [], values = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(months[d.getMonth()]);
    const total = expenses.filter(e => {
      const ed = new Date(e.date);
      return ed.getMonth() === d.getMonth() && ed.getFullYear() === d.getFullYear();
    }).reduce((s, e) => s + e.amount, 0);
    values.push(total);
  }
  return { labels, values };
}

function generateInsights(bankTotal, stockTotal, fdTotal, fundTotal, cardDebt, monthExp) {
  const insights = [];
  const total = bankTotal + stockTotal + fdTotal + fundTotal;

  if (total > 0) {
    const stockPct = (stockTotal / total * 100).toFixed(0);
    if (stockPct < 20) insights.push({ icon: '📊', text: `Your stock allocation is only ${stockPct}% of assets. Consider diversifying into equities for long-term growth.` });
    else if (stockPct > 60) insights.push({ icon: '⚠️', text: `${stockPct}% in stocks is aggressive. Consider balancing with bonds or fixed deposits to reduce risk.` });
    else insights.push({ icon: '✅', text: `Good balance! Your portfolio is well-diversified across ${stockPct}% equities and other assets.` });
  }

  if (cardDebt > 0) {
    const utilization = (cardDebt / STATE.data.cards.reduce((s,c) => s + c.credit_limit, 0) * 100).toFixed(0);
    if (utilization > 30) insights.push({ icon: '💳', text: `Credit utilization at ${utilization}%. Aim to keep it below 30% for a healthy credit profile.` });
  }

  const upcomingFDs = STATE.data.fixed_deposits.filter(f => daysUntil(f.maturity_date) <= 30 && daysUntil(f.maturity_date) > 0);
  if (upcomingFDs.length) insights.push({ icon: '📅', text: `${upcomingFDs.length} fixed deposit(s) mature within 30 days. Plan reinvestment now for uninterrupted returns.` });

  if (fundTotal > 0) {
    const fundGain = STATE.data.funds.reduce((s,f) => s + (f.current_value - f.invested_amount), 0);
    const fundPct  = (fundGain / STATE.data.funds.reduce((s,f) => s + f.invested_amount, 0) * 100).toFixed(1);
    insights.push({ icon: '💰', text: `Your mutual funds are ${fundGain >= 0 ? 'up' : 'down'} ${Math.abs(fundPct)}% overall. ${fundGain >= 0 ? 'Stay invested for compounding gains.' : 'Review fund performance against benchmarks.'}` });
  }

  if (!insights.length) insights.push({ icon: '🚀', text: 'Add your accounts and investments to unlock personalized AI insights about your portfolio.' });

  setHTML('insights-list', insights.map(ins =>
    `<div class="insight-item"><span class="insight-icon">${ins.icon}</span><p>${ins.text}</p></div>`
  ).join(''));
}

/* ─── BANKS ─────────────────────────────────────────────────────────────────── */
function renderBanks() {
  const banks = STATE.data.banks;
  const total = banks.reduce((s, b) => s + b.balance, 0);
  setText('banks-total', fmt(total));

  if (!banks.length) {
    setHTML('banks-list', '<div class="empty-state">No bank accounts added yet. Click "+ Add Account" to start.</div>');
    return;
  }
  setHTML('banks-list', banks.map(b => `
    <div class="glass-card bank-item" data-id="${b.id}">
      <div class="item-header">
        <div>
          <div class="item-name">${b.account_name}</div>
          <div class="item-bank">${b.bank_name}</div>
        </div>
        <span class="item-badge">${b.currency}</span>
      </div>
      <div class="item-amount">${fmt(b.balance, b.currency)}</div>
      <div class="item-actions">
        <button class="btn-delete" onclick="deleteItem('banks', ${b.id})">Delete</button>
      </div>
    </div>`).join(''));
}

/* ─── CARDS ─────────────────────────────────────────────────────────────────── */
function renderCards() {
  const cards = STATE.data.cards;
  if (!cards.length) {
    setHTML('cards-list', '<div class="empty-state">No cards added yet.</div>');
    return;
  }
  setHTML('cards-list', cards.map(c => {
    const util = ((c.outstanding_balance / c.credit_limit) * 100).toFixed(0);
    const days = daysUntil(c.due_date);
    return `
    <div class="glass-card card-item" data-id="${c.id}">
      <div class="credit-card-visual">
        <div class="card-chip">💳</div>
        <div class="card-number">•••• •••• •••• 4242</div>
        <div class="card-bottom">
          <div class="card-holder">${c.card_name}</div>
          <div class="card-limit">Limit: ${fmt(c.credit_limit)}</div>
        </div>
      </div>
      <div class="item-bank">${c.bank}</div>
      <div class="progress-wrap">
        <div class="progress-labels">
          <span>Used: ${fmt(c.outstanding_balance)}</span>
          <span>${util}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${util > 50 ? 'warn' : ''}" style="width: ${Math.min(util,100)}%"></div>
        </div>
      </div>
      <div class="fd-countdown">📅 Due in ${days > 0 ? days + ' days' : 'OVERDUE'} — ${c.due_date}</div>
      <div class="item-actions">
        <button class="btn-delete" onclick="deleteItem('cards', ${c.id})">Delete</button>
      </div>
    </div>`; }).join(''));
}

/* ─── STOCKS ─────────────────────────────────────────────────────────────────── */
function renderStocks() {
  const stocks = STATE.data.stocks;
  const totalValue    = stocks.reduce((s, s2) => s + ((s2.current_price || s2.purchase_price) * s2.shares), 0);
  const totalInvested = stocks.reduce((s, s2) => s + (s2.purchase_price * s2.shares), 0);
  const totalPnL      = totalValue - totalInvested;
  const pnlPct        = totalInvested ? (totalPnL / totalInvested * 100) : 0;

  setText('stocks-total',    fmt(totalValue));
  setText('stocks-invested', fmt(totalInvested));
  const pnlEl = el('stocks-pnl');
  if (pnlEl) {
    pnlEl.textContent = `${fmt(totalPnL)} (${fmtPct(pnlPct)})`;
    pnlEl.className = `port-value ${totalPnL >= 0 ? 'positive' : 'negative'}`;
  }

  if (!stocks.length) {
    el('stocks-tbody').innerHTML = '<tr><td colspan="8" class="empty-cell">No stocks added. Click "+ Add Stock" to start tracking.</td></tr>';
    return;
  }

  el('stocks-tbody').innerHTML = stocks.map(s => {
    const curPrice = s.current_price || s.purchase_price;
    const value    = curPrice * s.shares;
    const pnl      = (curPrice - s.purchase_price) * s.shares;
    const pct      = ((curPrice - s.purchase_price) / s.purchase_price * 100);
    return `
    <tr>
      <td><span class="stock-symbol">${s.symbol}</span></td>
      <td>${s.company_name}</td>
      <td class="price-mono">${s.shares.toLocaleString()}</td>
      <td class="price-mono">${fmtDecimal(s.purchase_price)}</td>
      <td class="price-mono">${fmtDecimal(curPrice)}</td>
      <td class="price-mono">${fmt(value)}</td>
      <td class="${pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}">${fmt(pnl)} <small>(${fmtPct(pct)})</small></td>
      <td><button class="btn-delete" onclick="deleteItem('stocks', ${s.id})">✕</button></td>
    </tr>`;
  }).join('');
}

/* ─── FIXED DEPOSITS ────────────────────────────────────────────────────────── */
function renderFDs() {
  const fds = STATE.data.fixed_deposits;
  const total = fds.reduce((s, f) => s + calcFDMaturity(f.principal, f.interest_rate, f.start_date, f.maturity_date), 0);
  setText('fd-total', fmt(total));

  if (!fds.length) {
    setHTML('fd-list', '<div class="empty-state">No fixed deposits added yet.</div>');
    return;
  }
  setHTML('fd-list', fds.map(f => {
    const maturity  = calcFDMaturity(f.principal, f.interest_rate, f.start_date, f.maturity_date);
    const interest  = maturity - f.principal;
    const days      = daysUntil(f.maturity_date);
    const progDays  = (new Date(f.maturity_date) - new Date(f.start_date)) / 86400000;
    const elapsed   = Math.max(0, progDays - Math.max(0, days));
    const prog      = Math.min(100, (elapsed / progDays * 100)).toFixed(0);

    return `
    <div class="glass-card fd-item">
      <div class="item-header">
        <div>
          <div class="item-name">${f.bank}</div>
          <div class="item-bank">${f.interest_rate}% p.a.</div>
        </div>
        <span class="item-badge">${days > 0 ? days + 'd left' : 'Matured'}</span>
      </div>
      <div class="item-amount">${fmt(maturity)}</div>
      <div class="item-bank">Principal: ${fmt(f.principal)} · Interest: +${fmt(interest)}</div>
      <div class="progress-wrap">
        <div class="progress-labels"><span>${f.start_date}</span><span>${f.maturity_date}</span></div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${prog}%"></div>
        </div>
      </div>
      ${days > 0 && days <= 30 ? `<div class="fd-countdown">⚠️ Matures in ${days} days!</div>` : ''}
      <div class="item-actions">
        <button class="btn-delete" onclick="deleteItem('fixed_deposits', ${f.id})">Delete</button>
      </div>
    </div>`;
  }).join(''));
}

/* ─── FUNDS ─────────────────────────────────────────────────────────────────── */
function renderFunds() {
  const funds = STATE.data.funds;
  if (!funds.length) {
    setHTML('funds-list', '<div class="empty-state">No funds added yet.</div>');
    return;
  }
  setHTML('funds-list', funds.map(f => {
    const gain    = f.current_value - f.invested_amount;
    const gainPct = (gain / f.invested_amount * 100);
    return `
    <div class="glass-card fund-item">
      <div class="item-header">
        <div class="item-name">${f.fund_name}</div>
        <span class="item-badge ${gain >= 0 ? 'positive' : 'negative'}">${fmtPct(gainPct)}</span>
      </div>
      <div class="item-amount">${fmt(f.current_value)}</div>
      <div class="item-bank">Invested: ${fmt(f.invested_amount)} · Gain: <span class="${gain >= 0 ? 'positive' : 'negative'}">${fmt(gain)}</span></div>
      <div class="item-bank">Since: ${f.purchase_date}</div>
      <div class="item-actions">
        <button class="btn-delete" onclick="deleteItem('funds', ${f.id})">Delete</button>
      </div>
    </div>`;
  }).join(''));
}

/* ─── EXPENSES ───────────────────────────────────────────────────────────────── */
function renderExpenses() {
  const expenses = STATE.data.expenses;
  const now  = new Date();
  const ms   = new Date(now.getFullYear(), now.getMonth(), 1);
  const ws   = new Date(now); ws.setDate(now.getDate() - 7);
  const tod  = now.toISOString().split('T')[0];

  const monthTotal = expenses.filter(e => new Date(e.date) >= ms).reduce((s,e) => s + e.amount, 0);
  const weekTotal  = expenses.filter(e => new Date(e.date) >= ws).reduce((s,e) => s + e.amount, 0);
  const dayTotal   = expenses.filter(e => e.date === tod).reduce((s,e) => s + e.amount, 0);

  setText('exp-month-total', fmt(monthTotal));
  setText('exp-week-total',  fmt(weekTotal));
  setText('exp-today-total', fmt(dayTotal));

  // Category chart
  const catMap = {};
  expenses.filter(e => new Date(e.date) >= ms).forEach(e => {
    catMap[e.category] = (catMap[e.category] || 0) + e.amount;
  });
  const cats = Object.keys(catMap);
  makeChart('chart-exp-cat', {
    type: 'doughnut',
    data: {
      labels: cats,
      datasets: [{ data: cats.map(c => catMap[c]), backgroundColor: PALETTE.slice(0, cats.length), borderWidth: 0, hoverOffset: 4 }]
    },
    options: { ...chartDefaults(), cutout: '65%', plugins: { ...chartDefaults().plugins, legend: { ...chartDefaults().plugins.legend, position: 'bottom' } } }
  });

  // Daily trend (last 14 days)
  const labels14 = [], values14 = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    labels14.push(ds.slice(5));
    values14.push(expenses.filter(e => e.date === ds).reduce((s,e) => s + e.amount, 0));
  }
  makeChart('chart-exp-trend', {
    type: 'line',
    data: { labels: labels14, datasets: [{ label: 'Daily Spend', data: values14,
        borderColor: '#a78bfa', borderWidth: 2, pointRadius: 3, tension: 0.4, fill: true,
        backgroundColor: (ctx) => {
          const g = ctx.chart.ctx.createLinearGradient(0,0,0,200);
          g.addColorStop(0,'rgba(167,139,250,0.2)'); g.addColorStop(1,'rgba(167,139,250,0)');
          return g;
        }
      }]
    },
    options: { ...chartDefaults(), scales: {
      x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#666', maxTicksLimit: 7 } },
      y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#666', callback: v => fmt(v) } },
    }}
  });

  // Table
  el('expenses-tbody').innerHTML = expenses.length
    ? expenses.slice(0, 50).map(e => `
        <tr>
          <td>${e.date}</td>
          <td><span class="item-badge">${e.category}</span></td>
          <td>${e.description}</td>
          <td class="price-mono">${fmt(e.amount)}</td>
          <td><button class="btn-delete" onclick="deleteItem('expenses', ${e.id})">✕</button></td>
        </tr>`).join('')
    : '<tr><td colspan="5" class="empty-cell">No expenses logged yet.</td></tr>';
}

/* ─── BUDGETS ───────────────────────────────────────────────────────────────── */
function renderBudgets() {
  const budgets  = STATE.data.budgets;
  const expenses = STATE.data.expenses;
  const now = new Date();
  const ms  = new Date(now.getFullYear(), now.getMonth(), 1);

  if (!budgets.length) {
    setHTML('budgets-list', '<div class="empty-state">No budgets set. Click "+ Set Budget".</div>');
    return;
  }

  setHTML('budgets-list', budgets.map(b => {
    const used = expenses.filter(e => e.category === b.category && new Date(e.date) >= ms)
                         .reduce((s, e) => s + e.amount, 0);
    const pct  = Math.min(100, (used / b.budget_limit * 100));
    let status = 'budget-ok', statusLabel = 'On Track';
    if (pct >= 100) { status = 'budget-over'; statusLabel = 'Over Budget'; }
    else if (pct >= 70) { status = 'budget-warn'; statusLabel = `${(100-pct).toFixed(0)}% left`; }

    return `
    <div class="glass-card budget-item">
      <div class="budget-cat">${b.category}</div>
      <div class="budget-amounts">
        <span class="budget-used ${pct >= 100 ? 'negative' : ''}">${fmt(used)}</span>
        <span class="budget-sep">/</span>
        <span class="budget-limit">${fmt(b.budget_limit)}</span>
      </div>
      <div class="budget-bar-wrap">
        <div class="progress-bar">
          <div class="progress-fill ${pct >= 70 ? 'warn' : ''}" style="width:${pct}%"></div>
        </div>
      </div>
      <span class="budget-status ${status}">${statusLabel}</span>
      <button class="btn-delete" onclick="deleteItem('budgets', ${b.id})">✕</button>
    </div>`;
  }).join(''));
}

/* ─── NET WORTH ─────────────────────────────────────────────────────────────── */
function renderNetWorth() {
  const { banks, cards, fixed_deposits, funds, stocks } = STATE.data;

  const bankTotal  = banks.reduce((s, b) => s + b.balance, 0);
  const fdTotal    = fixed_deposits.reduce((s, f) => s + calcFDMaturity(f.principal, f.interest_rate, f.start_date, f.maturity_date), 0);
  const fundTotal  = funds.reduce((s, f) => s + (f.current_value || 0), 0);
  const stockTotal = stocks.reduce((s, s2) => s + ((s2.current_price || s2.purchase_price) * s2.shares), 0);
  const assets     = bankTotal + fdTotal + fundTotal + stockTotal;
  const liabilities = cards.reduce((s, c) => s + c.outstanding_balance, 0);
  const netWorth   = assets - liabilities;

  setText('nw-total', fmt(netWorth));
  setText('nw-assets-total', fmt(assets));
  setText('nw-liabilities-total', fmt(liabilities));
  el('nw-total').className = `hero-value ${netWorth >= 0 ? '' : 'negative'}`;

  setHTML('nw-assets-list', `
    <div class="nw-row"><span>Bank Accounts</span><span class="nw-row-val">${fmt(bankTotal)}</span></div>
    <div class="nw-row"><span>Fixed Deposits</span><span class="nw-row-val">${fmt(fdTotal)}</span></div>
    <div class="nw-row"><span>Mutual Funds</span><span class="nw-row-val">${fmt(fundTotal)}</span></div>
    <div class="nw-row"><span>Stock Portfolio</span><span class="nw-row-val">${fmt(stockTotal)}</span></div>`);

  setHTML('nw-liabilities-list', cards.map(c =>
    `<div class="nw-row"><span>${c.card_name}</span><span class="nw-row-val negative">${fmt(c.outstanding_balance)}</span></div>`
  ).join('') || '<div class="nw-row"><span>No liabilities</span><span class="nw-row-val">—</span></div>');

  // Composition bar chart
  makeChart('chart-nw-composition', {
    type: 'bar',
    data: {
      labels: ['Banks', 'Fixed Deposits', 'Funds', 'Stocks', 'Card Debt'],
      datasets: [{
        label: 'Amount',
        data: [bankTotal, fdTotal, fundTotal, stockTotal, -liabilities],
        backgroundColor: [PALETTE[0], PALETTE[2], PALETTE[1], PALETTE[3], 'rgba(248,113,113,0.7)'],
        borderRadius: 8, borderSkipped: false,
      }]
    },
    options: {
      ...chartDefaults(),
      indexAxis: 'y',
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#666', callback: v => fmt(v) } },
        y: { grid: { display: false }, ticks: { color: '#888' } },
      },
    }
  });
}

/* ─── MODALS ─────────────────────────────────────────────────────────────────── */
const FORMS = {
  banks: {
    title: 'Add Bank Account',
    fields: [
      { id: 'bank_name',    label: 'Bank Name',      type: 'text',   placeholder: 'Commercial Bank' },
      { id: 'account_name', label: 'Account Name',   type: 'text',   placeholder: 'Savings Account' },
      { id: 'balance',      label: 'Balance',         type: 'number', placeholder: '0' },
      { id: 'currency',     label: 'Currency',        type: 'select', options: ['LKR','USD','EUR','GBP','AUD'] },
    ],
  },
  cards: {
    title: 'Add Card',
    fields: [
      { id: 'card_name',           label: 'Card Name',         type: 'text',   placeholder: 'Visa Platinum' },
      { id: 'bank',                label: 'Bank',              type: 'text',   placeholder: 'HNB' },
      { id: 'credit_limit',        label: 'Credit Limit',      type: 'number', placeholder: '0' },
      { id: 'outstanding_balance', label: 'Outstanding',       type: 'number', placeholder: '0' },
      { id: 'due_date',            label: 'Payment Due Date',  type: 'date' },
    ],
  },
  fixed_deposits: {
    title: 'Add Fixed Deposit',
    fields: [
      { id: 'bank',          label: 'Bank',          type: 'text',   placeholder: 'Sampath Bank' },
      { id: 'principal',     label: 'Principal',     type: 'number', placeholder: '0' },
      { id: 'interest_rate', label: 'Interest Rate %', type: 'number', placeholder: '11.5' },
      { id: 'start_date',    label: 'Start Date',    type: 'date' },
      { id: 'maturity_date', label: 'Maturity Date', type: 'date' },
    ],
  },
  funds: {
    title: 'Add Fund',
    fields: [
      { id: 'fund_name',       label: 'Fund Name',       type: 'text',   placeholder: 'Ceybank Unit Trust' },
      { id: 'invested_amount', label: 'Invested Amount', type: 'number', placeholder: '0' },
      { id: 'current_value',   label: 'Current Value',   type: 'number', placeholder: '0' },
      { id: 'purchase_date',   label: 'Purchase Date',   type: 'date' },
    ],
  },
  stocks: {
    title: 'Add Stock',
    fields: [
      { id: 'symbol',         label: 'Symbol',         type: 'text',   placeholder: 'AAPL or COMB.N0000' },
      { id: 'company_name',   label: 'Company Name',   type: 'text',   placeholder: 'Apple Inc.' },
      { id: 'shares',         label: 'Shares',         type: 'number', placeholder: '10' },
      { id: 'purchase_price', label: 'Purchase Price', type: 'number', placeholder: '0.00' },
      { id: 'purchase_date',  label: 'Purchase Date',  type: 'date' },
    ],
  },
  expenses: {
    title: 'Log Expense',
    fields: [
      { id: 'date',        label: 'Date',        type: 'date' },
      { id: 'category',    label: 'Category',    type: 'select', options: ['Food','Transport','Utilities','Entertainment','Healthcare','Shopping','Education','Others'] },
      { id: 'description', label: 'Description', type: 'text',   placeholder: 'What was this for?' },
      { id: 'amount',      label: 'Amount',      type: 'number', placeholder: '0' },
    ],
  },
  budgets: {
    title: 'Set Monthly Budget',
    fields: [
      { id: 'category',     label: 'Category',    type: 'select', options: ['Food','Transport','Utilities','Entertainment','Healthcare','Shopping','Education','Others'] },
      { id: 'budget_limit', label: 'Monthly Limit', type: 'number', placeholder: '0' },
    ],
  },
};

let currentModalType = null;

function openModal(type) {
  currentModalType = type;
  const form = FORMS[type];
  el('modal-title').textContent = form.title;
  el('modal-body').innerHTML = form.fields.map(f => {
    if (f.type === 'select') {
      return `<div class="field-group">
        <label>${f.label}</label>
        <select id="mf-${f.id}" style="background:var(--bg-elevated);border:1px solid var(--border-glass);border-radius:var(--radius-sm);padding:0.75rem 1rem">
          ${f.options.map(o => `<option value="${o}">${o}</option>`).join('')}
        </select>
      </div>`;
    }
    return `<div class="field-group">
      <label>${f.label}</label>
      <input type="${f.type}" id="mf-${f.id}" placeholder="${f.placeholder || ''}" ${f.type==='date'?`value="${new Date().toISOString().split('T')[0]}"`:''} />
    </div>`;
  }).join('');

  el('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  el('modal-overlay').classList.add('hidden');
  currentModalType = null;
}

el('modal-close').addEventListener('click', closeModal);
el('modal-cancel').addEventListener('click', closeModal);
el('modal-overlay').addEventListener('click', e => { if (e.target === el('modal-overlay')) closeModal(); });

el('modal-save').addEventListener('click', async () => {
  if (!currentModalType) return;
  const form = FORMS[currentModalType];
  const record = {};
  let valid = true;

  form.fields.forEach(f => {
    const input = el(`mf-${f.id}`);
    if (!input) return;
    let val = input.value.trim();
    if (f.type === 'number') val = parseFloat(val) || 0;
    record[f.id] = val;
    if (!val && f.type !== 'number') valid = false;
  });

  if (!valid) { toast('Please fill in all fields.', 'error'); return; }

  // Uppercase stock symbols
  if (currentModalType === 'stocks' && record.symbol) record.symbol = record.symbol.toUpperCase();

  record.id = Date.now();

  if (STATE.isDemo) {
    STATE.data[currentModalType] = [record, ...STATE.data[currentModalType]];
  } else {
    record.user_id = STATE.user.id;
    const { data, error } = await supabase.from(
      currentModalType === 'banks' ? 'bank_accounts' : currentModalType
    ).insert([record]).select();
    if (error) { toast(error.message, 'error'); return; }
    STATE.data[currentModalType] = [data[0], ...STATE.data[currentModalType]];
  }

  toast('Saved!', 'success');
  closeModal();
  renderAll();

  // Fetch live price for new stock
  if (currentModalType === 'stocks') {
    const idx = STATE.data.stocks.findIndex(s => s.id === record.id);
    fetchStockPrice(record.symbol).then(price => {
      if (price && idx !== -1) {
        STATE.data.stocks[idx].current_price = price;
        renderStocks();
      }
    });
  }
});

// Add buttons
el('btn-add-bank')?.addEventListener('click', () => openModal('banks'));
el('btn-add-card')?.addEventListener('click', () => openModal('cards'));
el('btn-add-stock')?.addEventListener('click', () => openModal('stocks'));
el('btn-add-fd')?.addEventListener('click', () => openModal('fixed_deposits'));
el('btn-add-fund')?.addEventListener('click', () => openModal('funds'));
el('btn-add-expense')?.addEventListener('click', () => openModal('expenses'));
el('btn-add-budget')?.addEventListener('click', () => openModal('budgets'));

/* ─── DELETE ─────────────────────────────────────────────────────────────────── */
async function deleteItem(type, id) {
  if (!confirm('Delete this item?')) return;

  if (STATE.isDemo) {
    STATE.data[type] = STATE.data[type].filter(item => item.id !== id);
  } else {
    const table = type === 'banks' ? 'bank_accounts' : type;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) { toast(error.message, 'error'); return; }
    STATE.data[type] = STATE.data[type].filter(item => item.id !== id);
  }

  toast('Deleted.', 'info');
  renderAll();
}

// Expose globally for inline onclick handlers
window.deleteItem = deleteItem;
