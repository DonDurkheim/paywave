// ========================================
// WEBSOCKET & STATE
// ========================================
const BACKEND_URL = `${location.protocol}//${location.hostname}:${location.port}`;
const socket = io(BACKEND_URL);

// Global state
let currentRole = 'admin'; // 'admin' or 'cashier'
let lastScannedUid = null;
let lastScannedBalance = null;
let products = [];

// ========================================
// DOM ELEMENTS
// ========================================
// Shared
const cardVisual = document.getElementById('card-visual');
const cardUidDisplay = document.getElementById('card-uid-display');
const cardBalanceDisplay = document.getElementById('card-balance-display');
const statusDisplay = document.getElementById('status-display');
const logList = document.getElementById('log-list');
const connectionStatus = document.getElementById('connection-status');

// Role selector
const roleAdminBtn = document.getElementById('role-admin');
const roleCashierBtn = document.getElementById('role-cashier');
const adminPanel = document.getElementById('admin-panel');
const cashierPanel = document.getElementById('cashier-panel');

// Admin interface
const adminUid = document.getElementById('admin-uid');
const adminCurrentBalance = document.getElementById('admin-current-balance');
const adminAmount = document.getElementById('admin-amount');
const adminTopupBtn = document.getElementById('admin-topup-btn');
const adminResponse = document.getElementById('admin-response');

// Cashier interface
const cashierUid = document.getElementById('cashier-uid');
const cashierCurrentBalance = document.getElementById('cashier-current-balance');
const cashierProduct = document.getElementById('cashier-product');
const cashierQuantity = document.getElementById('cashier-quantity');
const cashierTotalCost = document.getElementById('cashier-total-cost');
const cashierPayBtn = document.getElementById('cashier-pay-btn');
const cashierResponse = document.getElementById('cashier-response');

// ========================================
// ROLE MANAGEMENT
// ========================================
roleAdminBtn.addEventListener('click', () => {
    if (currentRole === 'admin') return;
    currentRole = 'admin';
    roleAdminBtn.classList.add('active');
    roleCashierBtn.classList.remove('active');
    
    // Smooth transition
    adminPanel.style.display = 'block';
    cashierPanel.style.display = 'none';
    
    clearResponses();
    addLog('Switched to 👤 Admin interface');
});

roleCashierBtn.addEventListener('click', () => {
    if (currentRole === 'cashier') return;
    currentRole = 'cashier';
    roleCashierBtn.classList.add('active');
    roleAdminBtn.classList.remove('active');
    
    // Smooth transition
    cashierPanel.style.display = 'block';
    adminPanel.style.display = 'none';
    
    clearResponses();
    addLog('Switched to 💳 Cashier interface');
});

// ========================================
// WEBSOCKET EVENTS
// ========================================
socket.on('connect', () => {
    addLog('✨ System synchronization complete');
    connectionStatus.textContent = '● Online';
    connectionStatus.className = 'status-online';

    // Request products on connect
    socket.emit('request-products');
});

socket.on('disconnect', () => {
    addLog('⚠️ Connection lost - attempting to reconnect');
    connectionStatus.textContent = '● Offline';
    connectionStatus.className = 'status-offline';
});

// Card scanned event
socket.on('card-scanned', (data) => {
    const { uid } = data;
    addLog(`🔍 RFID Signal Detected: ${uid}`);

    lastScannedUid = uid;

    // Update shared display
    cardVisual.classList.add('active');
    cardUidDisplay.textContent = uid;
    
    // Animation effect
    cardVisual.style.transform = 'rotateY(10deg) scale(1.05)';
    setTimeout(() => { cardVisual.style.transform = ''; }, 500);

    // Update role-specific fields
    adminUid.value = uid;
    adminTopupBtn.disabled = false;

    cashierUid.value = uid;
    if (products.length > 0) {
        cashierPayBtn.disabled = false;
    }

    // Fetch actual balance from database
    socket.emit('request-balance', { uid });

    statusDisplay.innerHTML = `
    <div class="data-row">
      <span class="data-label">UID:</span>
      <span class="data-value">${uid}</span>
    </div>
    <div class="data-row">
      <span class="data-label">Identity:</span>
      <span class="data-value" style="color: var(--primary);">Verifying...</span>
    </div>
    <div class="data-row">
      <span class="data-label">Status:</span>
      <span class="data-value" style="color: var(--success);">✓ Active</span>
    </div>
  `;

    clearResponses();
});

// Top-up success
socket.on('topup-success', (data) => {
    const { uid, amount, newBalance } = data;
    addLog(`✅ Top-up Auth: +$${amount.toFixed(2)} | Balance: $${newBalance.toFixed(2)}`);

    if (uid === lastScannedUid) {
        lastScannedBalance = newBalance;
        cardBalanceDisplay.textContent = `$${newBalance.toFixed(2)}`;
        adminCurrentBalance.value = `$${newBalance.toFixed(2)}`;

        triggerTransactionEffect('success');
    }

    adminResponse.className = 'response-message success';
    adminResponse.innerHTML = `<strong>✓ Transaction Approved</strong><span>+$${amount.toFixed(2)} credited</span>`;
    adminAmount.value = '';
});

// Payment success
socket.on('payment-success', (data) => {
    const { uid, amount, newBalance } = data;
    addLog(`💰 Payment Approved: -$${amount.toFixed(2)} | Balance: $${newBalance.toFixed(2)}`);

    if (uid === lastScannedUid) {
        lastScannedBalance = newBalance;
        cardBalanceDisplay.textContent = `$${newBalance.toFixed(2)}`;
        cashierCurrentBalance.value = `$${newBalance.toFixed(2)}`;

        triggerTransactionEffect('success');
    }

    cashierResponse.className = 'response-message success';
    cashierResponse.innerHTML = `<strong>✓ Payment Confirmed</strong><span>-$${amount.toFixed(2)} processed</span>`;
    cashierQuantity.value = '1';
    cashierTotalCost.value = '$0.00';
});

// Payment declined
socket.on('payment-declined', (data) => {
    const { reason, required, available } = data;
    addLog(`❌ Transaction Terminated: ${reason}`);

    triggerTransactionEffect('error');

    cashierResponse.className = 'response-message error';
    cashierResponse.innerHTML = `<strong>✗ Declined</strong><span>${reason} (Req: $${required.toFixed(2)})</span>`;
});

// Products received
socket.on('products-response', (data) => {
    if (data.success) {
        products = data.products;
        populateProductList();
        addLog(`📦 Inventory loaded: ${products.length} items`);
    }
});

// Balance response - fetched from database
socket.on('balance-response', (data) => {
    if (data.success && data.uid === lastScannedUid) {
        const balance = data.balance !== null ? data.balance : 0;
        lastScannedBalance = balance;

        // Update displays
        const formattedBalance = `$${balance.toFixed(2)}`;
        cardBalanceDisplay.textContent = formattedBalance;
        adminCurrentBalance.value = formattedBalance;
        cashierCurrentBalance.value = formattedBalance;

        // Update status display
        const statusRow = statusDisplay.querySelector('.data-row:nth-child(2)');
        if (statusRow) {
            statusRow.innerHTML = `
                <span class="data-label">Balance:</span>
                <span class="data-value" style="color: var(--success);">${formattedBalance}</span>
            `;
        }

        addLog(`📊 Secure Balance sync: ${formattedBalance}`);
    }
});

// ========================================
// ADMIN INTERFACE HANDLERS
// ========================================
adminAmount.addEventListener('input', () => {
    adminTopupBtn.disabled = !(lastScannedUid && adminAmount.value && parseFloat(adminAmount.value) > 0);
});

adminTopupBtn.addEventListener('click', async () => {
    const amount = parseFloat(adminAmount.value);
    if (!lastScannedUid || isNaN(amount) || amount <= 0) return;

    adminTopupBtn.disabled = true;
    adminTopupBtn.textContent = 'Processing...';

    try {
        const response = await fetch(`${BACKEND_URL}/topup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: lastScannedUid, amount })
        });

        const result = await response.json();
        if (!result.success) {
            adminResponse.className = 'response-message error';
            adminResponse.textContent = `Error: ${result.error}`;
            triggerTransactionEffect('error');
        }
    } catch (error) {
        adminResponse.className = 'response-message error';
        adminResponse.textContent = 'Network Timeout';
        triggerTransactionEffect('error');
    } finally {
        adminTopupBtn.disabled = false;
        adminTopupBtn.textContent = 'Confirm Transaction';
    }
});

// ========================================
// CASHIER INTERFACE HANDLERS
// ========================================
function populateProductList() {
    cashierProduct.innerHTML = '<option value="">-- Select Product --</option>';
    products.forEach(product => {
        const option = document.createElement('option');
        option.value = product._id;
        option.textContent = `${product.name} — $${product.price.toFixed(2)}`;
        option.dataset.price = product.price;
        cashierProduct.appendChild(option);
    });
}

function calculateTotal() {
    const selected = cashierProduct.options[cashierProduct.selectedIndex];
    if (selected.value === "") {
        cashierTotalCost.value = '$0.00';
        return 0;
    }

    const price = parseFloat(selected.dataset.price);
    const qty = parseInt(cashierQuantity.value) || 1;
    const total = price * qty;

    cashierTotalCost.value = `$${total.toFixed(2)}`;
    return total;
}

cashierProduct.addEventListener('change', () => {
    calculateTotal();
    updatePayButtonState();
});

cashierQuantity.addEventListener('input', () => {
    calculateTotal();
    updatePayButtonState();
});

function updatePayButtonState() {
    const valid = lastScannedUid && cashierProduct.value && parseInt(cashierQuantity.value) > 0;
    cashierPayBtn.disabled = !valid;
}

cashierPayBtn.addEventListener('click', async () => {
    const productId = cashierProduct.value;
    const quantity = parseInt(cashierQuantity.value);
    const totalAmount = parseFloat(cashierTotalCost.value.replace('$', ''));

    cashierPayBtn.disabled = true;
    cashierPayBtn.textContent = 'Authorizing...';

    try {
        const response = await fetch(`${BACKEND_URL}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: lastScannedUid, productId, quantity, totalAmount })
        });

        const result = await response.json();
        if (!result.success) {
            cashierResponse.className = 'response-message error';
            cashierResponse.innerHTML = `<strong>✗ FAILED</strong><span>${result.reason || result.error}</span>`;
            triggerTransactionEffect('error');
        }
    } catch (error) {
        cashierResponse.className = 'response-message error';
        cashierResponse.textContent = 'Connection Error';
        triggerTransactionEffect('error');
    } finally {
        cashierPayBtn.disabled = false;
        cashierPayBtn.textContent = 'Authorize Payment';
    }
});

// ========================================
// UTILITY FUNCTIONS
// ========================================
function addLog(message) {
    const li = document.createElement('li');
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    li.innerHTML = `<span style="color: var(--primary); opacity: 0.6;">[${time}]</span> ${message}`;
    logList.prepend(li);

    if (logList.children.length > 50) logList.lastChild.remove();
}

function clearResponses() {
    adminResponse.className = 'response-message';
    adminResponse.innerHTML = '';
    cashierResponse.className = 'response-message';
    cashierResponse.innerHTML = '';
}

function triggerTransactionEffect(type) {
    const color = type === 'success' ? 'var(--success)' : 'var(--error)';
    cardVisual.style.boxShadow = `0 0 40px ${color}`;
    cardVisual.style.borderColor = color;
    
    setTimeout(() => {
        cardVisual.style.boxShadow = '';
        cardVisual.style.borderColor = '';
    }, 1000);
}

// ========================================
// INITIALIZATION
// ========================================
addLog('🚀 PayWave Dashboard v1.0 Initialized');
