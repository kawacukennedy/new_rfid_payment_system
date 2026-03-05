const API_BASE = `${window.location.protocol}//${window.location.host}/api`;
let products = [];
let ws;
let reconnectInterval;
let currentUser = JSON.parse(localStorage.getItem('user')) || null;
let authToken = localStorage.getItem('token') || null;

// -- UI Elements: Auth --
const authLayer = document.getElementById('auth-layer');
const authForm = document.getElementById('auth-form');
const authUsername = document.getElementById('auth-username');
const authPassword = document.getElementById('auth-password');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authFeedback = document.getElementById('auth-feedback');
const toggleAuthMode = document.getElementById('toggle-auth-mode');
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');

// -- UI Elements: Dashboard --
const dashboardLayer = document.getElementById('dashboard-layer');
const logoutBtn = document.getElementById('logout-btn');
const tabPayment = document.getElementById('tab-payment');
const tabTopup = document.getElementById('tab-topup');
const panelPayment = document.getElementById('panel-payment');
const panelTopup = document.getElementById('panel-topup');
const payForm = document.getElementById('pay-form');
const topupForm = document.getElementById('topup-form');
const tappedUid = document.getElementById('tapped-uid');
const tappedBalance = document.getElementById('tapped-balance');
const wsIndicator = document.getElementById('ws-indicator');
const wsText = document.getElementById('ws-text');
const activityList = document.getElementById('activity-list');
const refreshActivity = document.getElementById('refresh-activity');

// -- UI Elements: Receipt --
const receiptOverlay = document.getElementById('receipt-overlay');
const receiptModal = document.getElementById('receipt-modal');
const closeReceipt = document.getElementById('close-receipt');

// -- Auth Logic --
let isLoginMode = true;

function updateAuthUI() {
    if (authToken && currentUser) {
        authLayer.classList.add('hidden-auth');
        dashboardLayer.classList.remove('opacity-0', 'pointer-events-none', 'blur-xl');
        initDashboard();
    } else {
        authLayer.classList.remove('hidden-auth');
        dashboardLayer.classList.add('opacity-0', 'pointer-events-none', 'blur-xl');
    }
}

toggleAuthMode.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    authTitle.innerText = isLoginMode ? 'Welcome' : 'Create Account';
    authSubtitle.innerText = isLoginMode ? 'Sign in to manage RFID wallets' : 'Register to get started';
    authSubmitBtn.innerText = isLoginMode ? 'Sign In' : 'Sign Up';
    toggleAuthMode.innerText = isLoginMode ? 'Create new account' : 'Already have an account? Sign In';
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const endpoint = isLoginMode ? '/auth/login' : '/auth/register';
    const body = { username: authUsername.value, password: authPassword.value };

    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();

        if (res.ok) {
            if (isLoginMode) {
                authToken = data.token;
                currentUser = data.user;
                localStorage.setItem('token', authToken);
                localStorage.setItem('user', JSON.stringify(currentUser));
                updateAuthUI();
            } else {
                isLoginMode = true;
                toggleAuthMode.click();
                authFeedback.innerText = 'Registration successful! Please sign in.';
                authFeedback.classList.remove('hidden', 'text-ios-red');
                authFeedback.classList.add('text-ios-green');
            }
        } else {
            authFeedback.innerText = data.error || 'Authentication failed';
            authFeedback.classList.remove('hidden');
        }
    } catch (err) {
        authFeedback.innerText = 'Network error';
        authFeedback.classList.remove('hidden');
    }
});

logoutBtn.addEventListener('click', () => {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    updateAuthUI();
    if (ws) ws.close();
});

// -- Dashboard Logic --
function initDashboard() {
    connectWebSocket();
    loadProducts();
    loadTransactions();
}

refreshActivity.addEventListener('click', loadTransactions);

tabPayment.addEventListener('click', () => switchTab('payment'));
tabTopup.addEventListener('click', () => switchTab('topup'));

function switchTab(tab) {
    const isPayment = tab === 'payment';

    // UI Classes
    tabPayment.classList.toggle('bg-white', isPayment);
    tabPayment.classList.toggle('shadow-sm', isPayment);
    tabPayment.classList.toggle('text-ios-blue', isPayment);
    tabPayment.classList.toggle('text-slate-500', !isPayment);

    tabTopup.classList.toggle('bg-white', !isPayment);
    tabTopup.classList.toggle('shadow-sm', !isPayment);
    tabTopup.classList.toggle('text-ios-blue', !isPayment);
    tabTopup.classList.toggle('text-slate-500', isPayment);

    // Panel Visibility
    panelPayment.classList.toggle('opacity-100', isPayment);
    panelPayment.classList.toggle('scale-100', isPayment);
    panelPayment.classList.toggle('z-10', isPayment);
    panelPayment.classList.toggle('opacity-0', !isPayment);
    panelPayment.classList.toggle('scale-95', !isPayment);
    panelPayment.classList.toggle('pointer-events-none', !isPayment);

    panelTopup.classList.toggle('opacity-100', !isPayment);
    panelTopup.classList.toggle('scale-100', !isPayment);
    panelTopup.classList.toggle('z-10', !isPayment);
    panelTopup.classList.toggle('opacity-0', isPayment);
    panelTopup.classList.toggle('scale-95', isPayment);
    panelTopup.classList.toggle('pointer-events-none', isPayment);
}

async function loadTransactions() {
    try {
        const res = await authenticatedFetch('/transactions');
        if (!res.ok) {
            // Silently skip if endpoint not available or unauthorized
            if (res.status === 401) return;
            activityList.innerHTML = '<div class="glass p-6 rounded-[2.5rem] text-center text-slate-400 italic text-sm">Activity feed unavailable.</div>';
            return;
        }
        const txs = await res.json();

        if (!Array.isArray(txs) || txs.length === 0) {
            activityList.innerHTML = '<div class="glass p-6 rounded-[2.5rem] text-center text-slate-400 italic text-sm">No recent transactions found.</div>';
            return;
        }

        activityList.innerHTML = '';
        txs.forEach(tx => {
            const item = document.createElement('div');
            item.className = 'glass p-4 px-6 rounded-[2rem] flex items-center justify-between animate-spring-in shadow-ios-card';

            const isPayment = tx.type === 'PAYMENT';
            const iconColor = isPayment ? 'ios-red' : 'ios-green';
            const typeText = isPayment ? 'Payment' : 'Top-Up';
            const detailText = isPayment ? (tx.product_name || 'Product Purchase') : 'Credits Added';

            item.innerHTML = `
                <div class="flex items-center space-x-4">
                    <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-${iconColor}">
                        ${isPayment ?
                    '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>' :
                    '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>'
                }
                    </div>
                    <div>
                        <p class="font-bold text-slate-800">${typeText}</p>
                        <p class="text-xs text-slate-400 font-medium">${detailText} • ${new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                </div>
                <div class="flex items-center space-x-4">
                    <span class="font-black text-lg ${isPayment ? 'text-slate-900' : 'text-ios-green'}">
                        ${isPayment ? '-' : '+'}${tx.amount}
                    </span>
                    ${tx.has_receipt ? `
                        <button onclick="fetchAndShowReceipt(${tx.id})" class="p-2 bg-ios-blue/10 text-ios-blue rounded-xl ios-button">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                        </button>
                    ` : ''}
                </div>
            `;
            activityList.appendChild(item);
        });
    } catch (err) { /* Network error — silently ignore */ }
}

async function fetchAndShowReceipt(txId) {
    try {
        const res = await authenticatedFetch(`/receipt/${txId}`);
        const receipt = await res.json();
        if (res.ok) showReceipt(receipt);
        else alert(receipt.error);
    } catch (err) { alert('Failed to fetch receipt'); }
}

window.fetchAndShowReceipt = fetchAndShowReceipt; // Expose to global for inline onclick

// -- API Helpers --
async function authenticatedFetch(endpoint, options = {}) {
    options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${authToken}`
    };
    return fetch(`${API_BASE}${endpoint}`, options);
}

// -- Products & Payment --
async function loadProducts() {
    try {
        const res = await fetch(`${API_BASE}/products`);
        if (!res.ok) {
            console.warn('Failed to load products');
            return;
        }
        products = await res.json();

        if (!Array.isArray(products)) {
            console.warn('Products is not an array:', products);
            return;
        }

        const select = document.getElementById('pay-product');
        select.innerHTML = '<option value="" disabled selected>Choose a product</option>';
        products.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.innerText = `${p.name} (${p.price} CR)`;
            select.appendChild(opt);
        });
    } catch (err) { console.error('Load products err:', err); }
}

const payProduct = document.getElementById('pay-product');
const payQuantity = document.getElementById('pay-quantity');
const payTotal = document.getElementById('pay-total');

function calculateTotal() {
    const productId = parseInt(payProduct.value);
    const qty = parseInt(payQuantity.value) || 0;
    const product = products.find(p => p.id === productId);
    payTotal.innerText = product ? (product.price * qty) : 0;
}

payProduct.addEventListener('change', calculateTotal);
payQuantity.addEventListener('input', calculateTotal);

payForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
        uid: tappedUid.innerText,
        productId: parseInt(payProduct.value),
        quantity: parseInt(payQuantity.value)
    };
    if (body.uid === 'Waiting for tap...') return alert('Please tap a card first');

    try {
        const res = await authenticatedFetch('/pay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (res.ok) {
            showReceipt(data.receipt);
            animateBalance(parseInt(tappedBalance.innerText), data.newBalance);
            loadTransactions(); // Refresh history
        } else {
            alert(data.error);
        }
    } catch (err) { alert('Network Error'); }
});

topupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseInt(document.getElementById('topup-amount').value);
    const body = { uid: tappedUid.innerText, amount };

    try {
        const res = await authenticatedFetch('/topup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (res.ok) {
            alert('Top-up successful');
            animateBalance(parseInt(tappedBalance.innerText), data.newBalance);
            document.getElementById('topup-amount').value = '';
            loadTransactions(); // Refresh history
        } else { alert(data.error); }
    } catch (err) { alert('Network Error'); }
});

// -- WebSocket Logic --
function connectWebSocket() {
    ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`);

    ws.onopen = () => {
        wsIndicator.classList.replace('bg-ios-red', 'bg-ios-green');
        wsText.innerText = 'Connected';
        if (reconnectInterval) clearInterval(reconnectInterval);
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.event === 'BALANCE_UPDATE') {
                const { uid, newBalance } = data.payload;
                tappedUid.innerText = uid;
                document.getElementById('topup-uid').value = uid;
                animateBalance(parseInt(tappedBalance.innerText), newBalance);
                loadTransactions(); // Refresh history
            }
        } catch (err) { console.error('WS parse err', err); }
    };

    ws.onclose = () => {
        wsIndicator.classList.replace('bg-ios-green', 'bg-ios-red');
        wsText.innerText = 'Disconnected';
        reconnectInterval = setTimeout(connectWebSocket, 3000);
    };
}

// -- Receipt & Animations --
function showReceipt(receipt) {
    document.getElementById('receipt-id').innerText = `TXN: ${receipt.transactionId}`;
    document.getElementById('receipt-uid').innerText = receipt.uid;
    document.getElementById('receipt-product').innerText = receipt.productName;
    document.getElementById('receipt-qty').innerText = receipt.quantity;
    document.getElementById('receipt-total').innerText = receipt.totalCost;
    document.getElementById('receipt-balance').innerText = `${receipt.balanceAfter} CR`;

    receiptOverlay.classList.remove('opacity-0', 'pointer-events-none');
    receiptModal.classList.remove('scale-90');
    receiptModal.classList.add('scale-100');
}

closeReceipt.addEventListener('click', () => {
    receiptOverlay.classList.add('opacity-0', 'pointer-events-none');
    receiptModal.classList.add('scale-90');
    receiptModal.classList.remove('scale-100');
});

function animateBalance(start, end) {
    const duration = 1000;
    const startTime = performance.now();
    function update(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 5); // EaseOutQuint
        const current = Math.floor(start + (end - start) * ease);
        tappedBalance.innerText = current;
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

// Init
updateAuthUI();
if (authToken) initDashboard();
