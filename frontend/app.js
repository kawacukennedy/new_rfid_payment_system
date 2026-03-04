const API_BASE = `${window.location.protocol}//${window.location.host}/api`;
let products = [];
let ws;
let reconnectInterval;

// -- UI Elements --
const tabTopup = document.getElementById('tab-topup');
const tabPayment = document.getElementById('tab-payment');
const sectionTopup = document.getElementById('section-topup');
const sectionPayment = document.getElementById('section-payment');

const formTopup = document.getElementById('form-topup');
const formPayment = document.getElementById('form-payment');
const topupUid = document.getElementById('topup-uid');
const topupAmount = document.getElementById('topup-amount');
const payUid = document.getElementById('pay-uid');
const payProduct = document.getElementById('pay-product');
const payQuantity = document.getElementById('pay-quantity');
const payTotal = document.getElementById('pay-total');

const tappedUid = document.getElementById('tapped-uid');
const tappedBalance = document.getElementById('tapped-balance');
const wsIndicator = document.getElementById('ws-indicator');

const topupResult = document.getElementById('topup-result');
const payResult = document.getElementById('pay-result');

// -- Tab Switching Logic --
function switchTab(tab) {
    if (tab === 'payment') {
        tabPayment.classList.replace('tab-inactive', 'tab-active');
        tabTopup.classList.replace('tab-active', 'tab-inactive');

        sectionPayment.classList.remove('opacity-0', 'translate-x-[110%]', 'pointer-events-none', 'z-0');
        sectionPayment.classList.add('opacity-100', 'translate-x-0', 'z-10');

        sectionTopup.classList.remove('opacity-100', 'translate-x-0', 'z-10');
        sectionTopup.classList.add('opacity-0', '-translate-x-[110%]', 'pointer-events-none', 'z-0');
    } else {
        tabTopup.classList.replace('tab-inactive', 'tab-active');
        tabPayment.classList.replace('tab-active', 'tab-inactive');

        sectionTopup.classList.remove('opacity-0', '-translate-x-[110%]', 'pointer-events-none', 'z-0');
        sectionTopup.classList.add('opacity-100', 'translate-x-0', 'z-10');

        sectionPayment.classList.remove('opacity-100', 'translate-x-0', 'z-10');
        sectionPayment.classList.add('opacity-0', 'translate-x-[110%]', 'pointer-events-none', 'z-0');
    }
}

tabTopup.addEventListener('click', () => switchTab('topup'));
tabPayment.addEventListener('click', () => switchTab('payment'));

// -- WebSocket Logic --
function connectWebSocket() {
    ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`);

    ws.onopen = () => {
        console.log('Connected to WebSocket server');
        wsIndicator.classList.replace('bg-semantic-error', 'bg-semantic-success');
        if (reconnectInterval) clearInterval(reconnectInterval);
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.event === 'BALANCE_UPDATE') {
                const { uid, newBalance, previousBalance, transactionType, amount } = data.payload;

                // Animate balance change if this is the currently "tapped" card
                if (uid === tappedUid.innerText || tappedUid.innerText === 'Waiting for card...') {
                    tappedUid.innerText = uid;
                    animateBalance(parseInt(tappedBalance.innerText), newBalance);
                }

                // Auto-fill UID inputs
                topupUid.value = uid;
                payUid.value = uid;
            }
        } catch (err) {
            console.error('Error parsing WS message:', err);
        }
    };

    ws.onclose = () => {
        console.log('WebSocket disconnected. Attempting to reconnect...');
        wsIndicator.classList.replace('bg-semantic-success', 'bg-semantic-error');
        reconnectInterval = setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        ws.close();
    };
}

// Balance number animation function
function animateBalance(start, end) {
    if (start === end) {
        tappedBalance.innerText = end;
        return;
    }
    const duration = 500;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function: easeOutQuart
        const easeProgress = 1 - Math.pow(1 - progress, 4);

        const currentVal = Math.floor(start + (end - start) * easeProgress);
        tappedBalance.innerText = currentVal;

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            tappedBalance.innerText = end;
        }
    }
    requestAnimationFrame(update);
}


// -- Fetch Products --
async function loadProducts() {
    try {
        const res = await fetch(`${API_BASE}/products`);
        if (!res.ok) throw new Error('Failed to fetch products');
        products = await res.json();

        payProduct.innerHTML = '<option value="" disabled selected>Select a product...</option>';
        products.forEach(p => {
            payProduct.innerHTML += `<option value="${p.id}">${p.name} - ${p.price} credits</option>`;
        });
    } catch (err) {
        console.error(err);
        payProduct.innerHTML = '<option value="">Error loading products</option>';
    }
}

// Calculate total cost dynamically
function updateTotal() {
    const productId = parseInt(payProduct.value);
    const qty = parseInt(payQuantity.value) || 0;

    if (isNaN(productId)) {
        payTotal.innerText = '0';
        return;
    }

    const product = products.find(p => p.id === productId);
    if (product) {
        payTotal.innerText = (product.price * qty).toString();
    }
}

payProduct.addEventListener('change', updateTotal);
payQuantity.addEventListener('input', updateTotal);

// -- Submit Handlers --
function showMessage(element, type, message) {
    element.className = `mt-4 p-4 rounded-xl flex items-center mb-0 text-[14pt] animate-spring ${type === 'success' ? 'bg-[#ECFDF5] text-semantic-success border border-semantic-success/20' :
        'bg-[#FEF2F2] text-semantic-error border border-semantic-error/20'
        }`;

    const icon = type === 'success'
        ? `<svg class="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`
        : `<svg class="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;

    element.innerHTML = `${icon} <span>${message}</span>`;
    element.classList.remove('hidden');

    setTimeout(() => { element.classList.add('hidden'); }, 5000);
}

formTopup.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = formTopup.querySelector('button');
    btn.disabled = true;
    btn.innerHTML = 'Processing...';
    btn.classList.add('opacity-70');

    try {
        const body = {
            uid: topupUid.value.trim(),
            amount: parseInt(topupAmount.value)
        };
        const res = await fetch(`${API_BASE}/topup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();

        if (res.ok) {
            showMessage(topupResult, 'success', `Funded successfully! New balance: ${data.newBalance}`);
            topupAmount.value = '';
        } else {
            showMessage(topupResult, 'error', `Failed: ${data.error || 'Unknown error'}`);
        }
    } catch (error) {
        showMessage(topupResult, 'error', `Network error: ${error.message}`);
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Confirm Top-Up';
        btn.classList.remove('opacity-70');
    }
});

formPayment.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = formPayment.querySelector('button');
    btn.disabled = true;
    btn.innerHTML = 'Processing...';
    btn.classList.add('opacity-70');

    try {
        const body = {
            uid: payUid.value.trim(),
            productId: parseInt(payProduct.value),
            quantity: parseInt(payQuantity.value)
        };
        if (isNaN(body.productId)) {
            throw new Error("Please select a product");
        }

        const res = await fetch(`${API_BASE}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();

        if (res.ok) {
            showMessage(payResult, 'success', `Payment Approved. New balance: ${data.newBalance}`);
            payQuantity.value = '1';
            updateTotal();
        } else {
            showMessage(payResult, 'error', `Declined: ${data.error || 'Unknown error'}`);
        }
    } catch (error) {
        showMessage(payResult, 'error', `Error: ${error.message}`);
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Charge Card';
        btn.classList.remove('opacity-70');
    }
});

// -- Initialize --
connectWebSocket();
loadProducts();
