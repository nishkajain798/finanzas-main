const db = firebase.database();
const stockDiv = document.getElementById("stocks");

db.ref('stocks').on('value', snapshot => {
  stockDiv.innerHTML = '';
  const stocks = snapshot.val();
  for (let symbol in stocks) {
    const s = stocks[symbol];
    stockDiv.innerHTML += `
      <div>
        <strong>${symbol} (${s.name})</strong>: ₹${s.price}
        <button onclick="alert('Buy ${symbol}')">Buy</button>
        <button onclick="alert('Sell ${symbol}')">Sell</button>
      </div>
    `;
  }
});
