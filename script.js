// ====== SETUP ======
let stocks = [
  { symbol: 'TCS', price: 300, lastChange: 0, availableShares: 1000, maxShares: 1000 },
  { symbol: 'Lodha', price: 150, lastChange: 0, availableShares: 1000, maxShares: 1000 },
  { symbol: 'HCL', price: 300, lastChange: 0, availableShares: 1000, maxShares: 1000 },
  { symbol: 'Adani', price: 300, lastChange: 0, availableShares: 1000, maxShares: 1000 },
  { symbol: 'Zomato', price: 700, lastChange: 0, availableShares: 1000, maxShares: 1000 },
  { symbol: 'LIC', price: 5, lastChange: 0, availableShares: 1000, maxShares: 1000 },
  { symbol: 'Reliance', price: 235, lastChange: 0, availableShares: 1000, maxShares: 1000 },
];

let portfolio = {};
let cash = 10000;
let adminMode = false;

// ====== MAIN DISPLAY ======
function updateTable() {
  const tbody = document.querySelector('#stock-table tbody');
  tbody.innerHTML = '';

  stocks.forEach(stock => {
    const row = document.createElement('tr');

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
  document.getElementById('wealth').textContent = calculateWealth().toFixed(2);

}

// ====== TRADING LOGIC ======
function trade(symbol, isBuy) {
  const qty = parseInt(prompt(`${isBuy ? "Buy" : "Sell"} how many shares of ${symbol}?`));
  if (!qty || qty <= 0) return;

  const stock = stocks.find(s => s.symbol === symbol);
  const total = qty * stock.price;

  if (isBuy) {
    if (total > cash) return alert("Not enough cash!");
    if (qty > stock.availableShares) {
      return alert(`Only ${stock.availableShares} shares are available.`);
    }

    cash -= total;
    stock.availableShares -= qty;

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
    stock.availableShares += qty;

    if (portfolio[symbol].qty === 0) delete portfolio[symbol];
  }

  updateTable();
}

// ====== PRICE ADJUSTMENT ======
function adjustPrice(symbol, percentChange) {
  const stock = stocks.find(s => s.symbol === symbol);
  stock.lastChange = percentChange;
  stock.price += stock.price * percentChange / 100;
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
function calculateWealth() {
  let wealth = cash;
  for (let sym in portfolio) {
    const stock = stocks.find(s => s.symbol === sym);
    const p = portfolio[sym];
    wealth += stock.price * p.qty;
  }
  return wealth;
}

// ====== ADMIN TOGGLE ======
function toggleAdminMode() {
  adminMode = !adminMode;
  updateTable();
  const btn = document.getElementById('admin-toggle');
  btn.textContent = adminMode ? "🛡️ Admin Mode: ON" : "🛡️ Toggle Admin Mode";
}

// ====== INITIAL LOAD ======
window.onload = () => {
  updateTable();
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



