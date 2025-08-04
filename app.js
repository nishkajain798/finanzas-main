const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const session = require('express-session');
const cors = require('cors');
const yahooFinance = require('yahoo-finance2').default;
const { Server } = require('socket.io');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'stock-trading-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Database setup
const db = new sqlite3.Database('stock_trading.db');

// Create tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    balance REAL DEFAULT 10000,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Portfolio table
  db.run(`CREATE TABLE IF NOT EXISTS portfolio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    symbol TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    purchase_price REAL NOT NULL,
    purchase_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Transactions table
  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    symbol TEXT NOT NULL,
    type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    total_amount REAL NOT NULL,
    transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Create admin user
  const adminPassword = bcrypt.hashSync('jyoti', 10);
  db.run(`INSERT OR IGNORE INTO users (username, password, email, balance) 
          VALUES ('jyoti', ?, 'admin@stockmarket.com', 50000)`, [adminPassword]);
});

// Indian stock symbols for demo
const indianStocks = [
  'RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HINDUNILVR.NS', 'HDFC.NS',
  'ICICIBANK.NS', 'KOTAKBANK.NS', 'BHARTIARTL.NS', 'ITC.NS', 'SBIN.NS'
];

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// User registration
app.post('/register', async (req, res) => {
  const { username, password, email } = req.body;
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run(`INSERT INTO users (username, password, email) VALUES (?, ?, ?)`,
      [username, hashedPassword, email], function(err) {
        if (err) {
          res.json({ success: false, message: 'Username or email already exists' });
        } else {
          res.json({ success: true, message: 'Registration successful' });
        }
      });
  } catch (error) {
    res.json({ success: false, message: 'Registration failed' });
  }
});

// User login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
    if (err || !user) {
      res.json({ success: false, message: 'Invalid credentials' });
      return;
    }
    
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (passwordMatch) {
      req.session.userId = user.id;
      req.session.username = user.username;
      res.json({ success: true, message: 'Login successful', user: { username: user.username, balance: user.balance } });
    } else {
      res.json({ success: false, message: 'Invalid credentials' });
    }
  });
});

// Get user profile
app.get('/profile', (req, res) => {
  if (!req.session.userId) {
    res.json({ success: false, message: 'Not logged in' });
    return;
  }
  
  db.get(`SELECT username, email, balance FROM users WHERE id = ?`, [req.session.userId], (err, user) => {
    if (err || !user) {
      res.json({ success: false, message: 'User not found' });
    } else {
      res.json({ success: true, user });
    }
  });
});

// Get stock quotes
app.get('/stock/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol;
    const quote = await yahooFinance.quote(symbol);
    res.json({
      success: true,
      data: {
        symbol: quote.symbol,
        price: quote.regularMarketPrice,
        change: quote.regularMarketChange,
        changePercent: quote.regularMarketChangePercent,
        companyName: quote.shortName
      }
    });
  } catch (error) {
    res.json({ success: false, message: 'Failed to fetch stock data' });
  }
});

// Get multiple stocks
app.get('/stocks', async (req, res) => {
  try {
    const stockPromises = indianStocks.map(async (symbol) => {
      try {
        const quote = await yahooFinance.quote(symbol);
        return {
          symbol: quote.symbol,
          price: quote.regularMarketPrice,
          change: quote.regularMarketChange,
          changePercent: quote.regularMarketChangePercent,
          companyName: quote.shortName
        };
      } catch (error) {
        return null;
      }
    });
    
    const stocks = await Promise.all(stockPromises);
    const validStocks = stocks.filter(stock => stock !== null);
    
    res.json({ success: true, stocks: validStocks });
  } catch (error) {
    res.json({ success: false, message: 'Failed to fetch stocks' });
  }
});

// Buy stock
app.post('/buy', (req, res) => {
  if (!req.session.userId) {
    res.json({ success: false, message: 'Not logged in' });
    return;
  }
  
  const { symbol, quantity, price } = req.body;
  const totalAmount = quantity * price;
  
  // Check user balance
  db.get(`SELECT balance FROM users WHERE id = ?`, [req.session.userId], (err, user) => {
    if (err || !user) {
      res.json({ success: false, message: 'User not found' });
      return;
    }
    
    if (user.balance < totalAmount) {
      res.json({ success: false, message: 'Insufficient balance' });
      return;
    }
    
    // Update user balance
    db.run(`UPDATE users SET balance = balance - ? WHERE id = ?`, [totalAmount, req.session.userId]);
    
    // Add to portfolio
    db.run(`INSERT INTO portfolio (user_id, symbol, quantity, purchase_price) VALUES (?, ?, ?, ?)`,
      [req.session.userId, symbol, quantity, price]);
    
    // Add transaction
    db.run(`INSERT INTO transactions (user_id, symbol, type, quantity, price, total_amount) VALUES (?, ?, 'BUY', ?, ?, ?)`,
      [req.session.userId, symbol, quantity, price, totalAmount]);
    
    res.json({ success: true, message: 'Stock purchased successfully' });
  });
});

// Get user portfolio
app.get('/portfolio', (req, res) => {
  if (!req.session.userId) {
    res.json({ success: false, message: 'Not logged in' });
    return;
  }
  
  db.all(`SELECT symbol, SUM(quantity) as total_quantity, AVG(purchase_price) as avg_price 
          FROM portfolio WHERE user_id = ? GROUP BY symbol`, [req.session.userId], (err, portfolio) => {
    if (err) {
      res.json({ success: false, message: 'Failed to fetch portfolio' });
    } else {
      res.json({ success: true, portfolio });
    }
  });
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: 'Logged out successfully' });
});

// Socket.IO for real-time updates
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Send real-time stock updates every 30 seconds
setInterval(async () => {
  try {
    const stockPromises = indianStocks.slice(0, 5).map(async (symbol) => {
      try {
        const quote = await yahooFinance.quote(symbol);
        return {
          symbol: quote.symbol,
          price: quote.regularMarketPrice,
          change: quote.regularMarketChange,
          changePercent: quote.regularMarketChangePercent,
          companyName: quote.shortName
        };
      } catch (error) {
        return null;
      }
    });
    
    const stocks = await Promise.all(stockPromises);
    const validStocks = stocks.filter(stock => stock !== null);
    
    io.emit('stockUpdate', validStocks);
  } catch (error) {
    console.log('Error fetching real-time data:', error);
  }
}, 30000); // 30 seconds

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Stock Trading Server running on port ${PORT}`);
  console.log(`Admin login: username=jyoti, password=jyoti`);
});
