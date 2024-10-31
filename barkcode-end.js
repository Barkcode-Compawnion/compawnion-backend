const express = require("express");
const admin = require("firebase-admin");
const http = require("http");
const WebSocket = require("ws");

// Initialize APP
const app = express();
const PORT = 3000;

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// DATABASE

// Load service account key
const serviceAccount = require("./BarkCode.json");

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Get reference to Firestore
const db = admin.firestore();
// Get reference to Firebase Storage
const storage = admin.storage().bucket();

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// MIDDLEWARES

// Middleware to parse JSON bodies
app.use(express.json({
  limit: "50mb",
}));
app.use(express.urlencoded({
  extended: true,
  limit: "50mb",
}));

// Cors Middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ROUTES

const adminRoute = require("./ROUTES/Admins")(db, storage);
const applicationRoute = require("./ROUTES/application")(db, storage);
const compawnionRoute = require("./ROUTES/Compawnions")(db, storage);
const raRoute = require("./ROUTES/ra")(db, storage);
const superadminRoute = require("./ROUTES/superadmin")(db, storage);

app.use("/Admins", adminRoute);
app.use("/application", applicationRoute);
app.use("/Compawnions", compawnionRoute);
app.use("/ra", raRoute);
app.use("/superadmin", superadminRoute);

// Root route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to BarkCode API using Node.js and Express!" });
});

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//WEBSOCKETS

const server = http.createServer(app);

// Create WebSocket server using the HTTP server
const wss = new WebSocket.Server({ server });

// WebSocket connection event listener
wss.on("connection", (ws) => {
  console.log("New client connected!");

  // Listen for messages from the client
  ws.on("message", (data) => {
    console.log(`Received: ${data}`);

    // Send a response back to the client
    ws.send(`Server: ${data}`);
  });

  // Handle client disconnection
  ws.on("close", () => {
    console.log("Client disconnected.");
  });
});

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
