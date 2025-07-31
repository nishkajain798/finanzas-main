// ====== FIREBASE SETUP ======
alert("Script.js loaded");
console.log("Script.js is running - confirm!");


import { initializeApp } from "https://www.gstatic.com/firebasejs/10.3.1/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.3.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyA0tMZldpyUvFXpm66-fAtcS4veNQ8Rl",
  authDomain: "sse-stimulator.firebaseapp.com",
  databaseURL: "https://sse-stimulator-default-rtdb.firebaseio.com",
  projectId: "sse-stimulator",
  storageBucket: "sse-stimulator.appspot.com",
  messagingSenderId: "851332993194",
  appId: "1:851332993194:web:d36cde5787c25bebe80bd3"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// ====== SETUP ======
let stocks = [];
let portfolio = {};
let cash = 10000;
let adminMode = false;

// ====== MAIN DISPLAY ======
function updateTable() {
  const tbody = document.querySelector('#stock-table tbody');
  tbody.innerHTML = '';

  stocks.forEach(stock => {
    const row = document.createElement('tr');

    // Add adjust buttons only if adminMode is ON
    const adjustButtons = adminMode
      ? `<td>
           <button onclick="adjustPrice('${stock.symbol}', 1)">🔺</button>
           <button onclick="adjustPrice('${stock.symbol}', -1)">🔻</button>
         </td>`
      : `<td></td>`;

    row.innerHTML = `
      <td>${stock.symbol}</td>
      <td>${stock.price.toFixed(2)}</td>
      <td>${stock.lastChange.toFixed(2)}%</td>
      <td><button class="buy" onclick="trade('${stock.symbol}', true)">Buy</button></td>
      <td><button class="sell" onclick="trade('${stock.symbol}', false)">Sell</button></td>
      ${adjustButtons}
    `;

    tbody.appendChild(row);
  });

  document.getElementById('cash').textContent = cash.toFixed(2);
  renderPortfolio();
}

// ====== TRADING LOGIC ======
function trade(symbol, isBuy) {
  const qty = parseInt(prompt(`${isBuy ? "Buy" : "Sell"} how many shares of ${symbol}?`));
  if (!qty || qty <= 0) return;

  const stock = stocks.find(s => s.symbol === symbol);
  const total = qty * stock.price;

  if (isBuy) {
    if (total > cash) return alert("Not enough cash!");
    cash -= total;
    if (!portfolio[symbol]) portfolio[symbol] = { qty: 0, avg: 0 };
    const p = portfolio[symbol];
    p.avg = (p.avg * p.qty + total) / (p.qty + qty);
    p.qty += qty;
  } else {
    if (!portfolio[symbol] || portfolio[symbol].qty < qty) {
      return alert("You don’t own that many shares.");
    }
    cash += total;
    portfolio[symbol].qty -= qty;
    if (portfolio[symbol].qty === 0) delete portfolio[symbol];
  }

  updateTable();
}

function updateStockInFirebase(stock) {
  const stockRef = ref(database, 'stocks/' + stock.symbol);
  set(stockRef, {
    symbol: stock.symbol,
    price: stock.price,
    lastChange: stock.lastChange
  }).then(() => {
    console.log(`${stock.symbol} updated in Firebase`);
  }).catch((error) => {
    console.error("Firebase update failed:", error);
  });
}

// ====== PRICE ADJUSTMENT ======
function adjustPrice(symbol, percentChange) {
  const stock = stocks.find(s => s.symbol === symbol);
  stock.lastChange = percentChange;
  stock.price += stock.price * percentChange / 100;

  updateStockInFirebase(stock); // Firebase sync

  updateTable();
}

// ====== PORTFOLIO DISPLAY ======
function renderPortfolio() {
  const tbody = document.querySelector('#portfolio-table tbody');
  tbody.innerHTML = '';
  for (let sym in portfolio) {
    const p = portfolio[sym];
    const row = document.createElement('tr');
    row.innerHTML = `<td>${sym}</td><td>${p.qty}</td><td>${p.avg.toFixed(2)}</td>`;
    tbody.appendChild(row);
  }
}

// ====== ADMIN TOGGLE ======
function toggleAdminMode() {
  adminMode = !adminMode;
  updateTable();
  const btn = document.getElementById('admin-toggle');
  btn.textContent = adminMode ? "🛡️ Admin Mode: ON" : "🛡️ Toggle Admin Mode";
}

// ====== REAL-TIME LISTENER ======
function listenForStockUpdates() {
  const stocksRef = ref(database, 'stocks');
  onValue(stocksRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      stocks = Object.values(data);
      updateTable();
    }
  });
}

// ====== INITIAL LOAD ======
window.onload = () => {
  listenForStockUpdates();  // 🔁 Syncs with Firebase
  updateTable();            // Load initial UI
};

// ====== SECRET UNLOCK SHORTCUT ======
document.addEventListener("keydown", function (e) {
  if (e.ctrlKey && e.key === "m") {
    const pass = prompt("Enter admin password:");
    if (pass === "sse2025") {
      document.getElementById("admin-toggle").style.display = "inline-block";
      alert("Admin toggle unlocked!");
    } else {
      alert("Incorrect password.");
    }
  }
});

// Expose key functions globally so HTML can access them
window.trade = trade;
window.adjustPrice = adjustPrice;
window.toggleAdminMode = toggleAdminMode;
