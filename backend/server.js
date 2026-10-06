const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();

const PORT = 3000;
const JWT_SECRET = "novacart_secret_key_2026";


// ======================================================
// MIDDLEWARE
// ======================================================

app.use(cors());
app.use(express.json());


// ======================================================
// PROJECT & DATABASE
// ======================================================

const PROJECT_ROOT = path.join(__dirname, "..");

const db = new Database(
  path.join(__dirname, "novacart.db")
);


// ======================================================
// DATABASE TABLES
// ======================================================

db.exec(`

  CREATE TABLE IF NOT EXISTS users (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL,

    email TEXT UNIQUE NOT NULL,

    password TEXT NOT NULL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP

  );



  CREATE TABLE IF NOT EXISTS products (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL,

    description TEXT,

    price REAL NOT NULL,

    image TEXT

  );



  CREATE TABLE IF NOT EXISTS orders (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    user_id INTEGER NOT NULL,

    total REAL NOT NULL,

    status TEXT DEFAULT 'Pending',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
      REFERENCES users(id)

  );



  CREATE TABLE IF NOT EXISTS order_items (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    order_id INTEGER NOT NULL,

    product_id INTEGER NOT NULL,

    quantity INTEGER NOT NULL,

    price REAL NOT NULL,

    FOREIGN KEY (order_id)
      REFERENCES orders(id),

    FOREIGN KEY (product_id)
      REFERENCES products(id)

  );

`);


// ======================================================
// DATABASE MIGRATION
// ======================================================

// Agar purani products table mein image column nahi hai
// to automatically add ho jayega.

const productColumns =
  db.prepare(
    "PRAGMA table_info(products)"
  ).all();

const hasImageColumn =
  productColumns.some(
    column => column.name === "image"
  );

if (!hasImageColumn) {

  db.exec(
    "ALTER TABLE products ADD COLUMN image TEXT"
  );

}


// ======================================================
// PRODUCT DATA
// ======================================================

const productCount =
  db.prepare(
    "SELECT COUNT(*) AS count FROM products"
  ).get();


if (productCount.count === 0) {

  const insertProduct =
    db.prepare(`

      INSERT INTO products
      (name, description, price, image)

      VALUES
      (?, ?, ?, ?)

    `);


  insertProduct.run(

    "Smart Watch",

    "Modern smart watch with useful features.",

    49.99,

    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80"

  );


  insertProduct.run(

    "Wireless Headphones",

    "Comfortable wireless headphones with clear sound.",

    39.99,

    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80"

  );


  insertProduct.run(

    "Digital Camera",

    "High quality digital camera for photography.",

    299.99,

    "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=600&q=80"

  );


  insertProduct.run(

    "Running Shoes",

    "Comfortable running shoes for everyday activities.",

    59.99,

    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80"

  );


  insertProduct.run(

    "Travel Backpack",

    "Durable backpack suitable for travel and daily use.",

    34.99,

    "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=600&q=80"

  );


  insertProduct.run(

    "Modern Chair",

    "Stylish and comfortable modern chair.",

    89.99,

    "https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=600&q=80"

  );

}


// ======================================================
// API TEST
// ======================================================

app.get("/api/test", (req, res) => {

  res.json({

    success: true,

    message: "NovaCart backend is working."

  });

});


// ======================================================
// GET ALL PRODUCTS
// ======================================================

app.get("/api/products", (req, res) => {

  try {

    const products =
      db.prepare(
        "SELECT * FROM products ORDER BY id"
      ).all();


    res.json(products);

  } catch (error) {

    console.error(error);

    res.status(500).json({

      message: "Unable to load products."

    });

  }

});


// ======================================================
// GET SINGLE PRODUCT
// ======================================================

app.get("/api/products/:id", (req, res) => {

  try {

    const product =
      db.prepare(
        "SELECT * FROM products WHERE id = ?"
      ).get(req.params.id);


    if (!product) {

      return res.status(404).json({

        message: "Product not found."

      });

    }


    res.json(product);

  } catch (error) {

    console.error(error);

    res.status(500).json({

      message: "Unable to load product."

    });

  }

});


// ======================================================
// REGISTER
// ======================================================

app.post("/api/register", async (req, res) => {

  try {

    const {
      name,
      email,
      password
    } = req.body;


    if (!name || !email || !password) {

      return res.status(400).json({

        message:
          "Name, email and password are required."

      });

    }


    if (password.length < 6) {

      return res.status(400).json({

        message:
          "Password must be at least 6 characters."

      });

    }


    const cleanName =
      String(name).trim();

    const cleanEmail =
      String(email).trim().toLowerCase();


    const existingUser =
      db.prepare(
        "SELECT id FROM users WHERE email = ?"
      ).get(cleanEmail);


    if (existingUser) {

      return res.status(409).json({

        message:
          "An account with this email already exists."

      });

    }


    const hashedPassword =
      await bcrypt.hash(password, 10);


    const result =
      db.prepare(`

        INSERT INTO users
        (name, email, password)

        VALUES
        (?, ?, ?)

      `).run(

        cleanName,

        cleanEmail,

        hashedPassword

      );


    res.status(201).json({

      success: true,

      message:
        "Registration successful.",

      userId:
        result.lastInsertRowid

    });


  } catch (error) {

    console.error(error);

    res.status(500).json({

      message:
        "Registration failed."

    });

  }

});


// ======================================================
// LOGIN
// ======================================================

app.post("/api/login", async (req, res) => {

  try {

    const {
      email,
      username,
      password
    } = req.body;


    const loginValue =
      String(
        email || username || ""
      ).trim();


    if (!loginValue || !password) {

      return res.status(400).json({

        message:
          "Email/Username and password are required."

      });

    }


    const user =
      db.prepare(`

        SELECT *

        FROM users

        WHERE
          LOWER(email) = LOWER(?)

          OR

          LOWER(name) = LOWER(?)

      `).get(

        loginValue,

        loginValue

      );


    if (!user) {

      return res.status(401).json({

        message:
          "Invalid email/username or password."

      });

    }


    const passwordMatch =
      await bcrypt.compare(
        password,
        user.password
      );


    if (!passwordMatch) {

      return res.status(401).json({

        message:
          "Invalid email/username or password."

      });

    }


    const token =
      jwt.sign(

        {
          id: user.id,

          name: user.name,

          email: user.email

        },

        JWT_SECRET,

        {
          expiresIn: "7d"
        }

      );


    res.json({

      success: true,

      message: "Login successful.",

      token,

      user: {

        id: user.id,

        name: user.name,

        email: user.email

      }

    });


  } catch (error) {

    console.error(error);

    res.status(500).json({

      message:
        "Login failed."

    });

  }

});


// ======================================================
// AUTHENTICATION MIDDLEWARE
// ======================================================

function authenticateToken(req, res, next) {

  const authHeader =
    req.headers.authorization;


  if (!authHeader) {

    return res.status(401).json({

      message:
        "Authentication required."

    });

  }


  const parts =
    authHeader.split(" ");


  if (
    parts.length !== 2 ||
    parts[0] !== "Bearer"
  ) {

    return res.status(401).json({

      message:
        "Invalid authorization format."

    });

  }


  const token =
    parts[1];


  try {

    const decoded =
      jwt.verify(
        token,
        JWT_SECRET
      );


    req.user = decoded;

    next();

  } catch (error) {

    return res.status(401).json({

      message:
        "Invalid or expired token."

    });

  }

}


// ======================================================
// CURRENT USER
// ======================================================

app.get(
  "/api/me",
  authenticateToken,
  (req, res) => {

    try {

      const user =
        db.prepare(`

          SELECT
            id,
            name,
            email,
            created_at

          FROM users

          WHERE id = ?

        `).get(req.user.id);


      if (!user) {

        return res.status(404).json({

          message:
            "User not found."

        });

      }


      res.json(user);

    } catch (error) {

      console.error(error);

      res.status(500).json({

        message:
          "Unable to load user."

      });

    }

  }
);


// ======================================================
// CREATE ORDER
// ======================================================

app.post(
  "/api/orders",
  authenticateToken,
  (req, res) => {

    try {

      const { items } =
        req.body;


      if (
        !Array.isArray(items) ||
        items.length === 0
      ) {

        return res.status(400).json({

          message:
            "Cart is empty."

        });

      }


      let total = 0;

      const orderItems = [];


      // ------------------------------------------
      // Check every product
      // ------------------------------------------

      for (const item of items) {

        const productId =
          Number(item.productId);

        const quantity =
          Number(item.quantity);


        if (
          !Number.isInteger(productId) ||
          !Number.isInteger(quantity) ||
          quantity <= 0
        ) {

          return res.status(400).json({

            message:
              "Invalid order item."

          });

        }


        const product =
          db.prepare(`

            SELECT *

            FROM products

            WHERE id = ?

          `).get(productId);


        if (!product) {

          return res.status(404).json({

            message:
              `Product ${productId} not found.`

          });

        }


        const itemTotal =
          Number(product.price) *
          quantity;


        total += itemTotal;


        orderItems.push({

          productId,

          quantity,

          price:
            Number(product.price)

        });

      }


      // ------------------------------------------
      // Create order
      // ------------------------------------------

      const createOrder =
        db.transaction(() => {

          const orderResult =
            db.prepare(`

              INSERT INTO orders
              (user_id, total, status)

              VALUES
              (?, ?, ?)

            `).run(

              req.user.id,

              total,

              "Pending"

            );


          const orderId =
            orderResult.lastInsertRowid;


          const insertItem =
            db.prepare(`

              INSERT INTO order_items
              (order_id, product_id, quantity, price)

              VALUES
              (?, ?, ?, ?)

            `);


          for (const item of orderItems) {

            insertItem.run(

              orderId,

              item.productId,

              item.quantity,

              item.price

            );

          }


          return orderId;

        });


      const orderId =
        createOrder();


      res.status(201).json({

        success: true,

        message:
          "Order placed successfully.",

        orderId,

        total:
          Number(total.toFixed(2))

      });


    } catch (error) {

      console.error(error);

      res.status(500).json({

        message:
          "Unable to process order."

      });

    }

  }
);


// ======================================================
// GET USER ORDERS
// ======================================================

app.get(
  "/api/orders",
  authenticateToken,
  (req, res) => {

    try {

      const orders =
        db.prepare(`

          SELECT

            id,

            total,

            status,

            created_at

          FROM orders

          WHERE user_id = ?

          ORDER BY id DESC

        `).all(req.user.id);


      res.json(orders);

    } catch (error) {

      console.error(error);

      res.status(500).json({

        message:
          "Unable to load orders."

      });

    }

  }
);


// ======================================================
// SERVE FRONTEND
// ======================================================

app.use(
  express.static(PROJECT_ROOT)
);


app.get("/", (req, res) => {

  res.sendFile(
    path.join(
      PROJECT_ROOT,
      "index.html"
    )
  );

});


app.get("/product.html", (req, res) => {

  res.sendFile(
    path.join(
      PROJECT_ROOT,
      "product.html"
    )
  );

});


// ======================================================
// START SERVER
// ======================================================

app.listen(
  PORT,
  () => {

    console.log("");
    console.log("================================");
    console.log("       NovaCart Server");
    console.log("================================");
    console.log(
      `Server running at http://localhost:${PORT}`
    );
    console.log(
      `API test: http://localhost:${PORT}/api/test`
    );
    console.log("================================");
    console.log("");

  }
);