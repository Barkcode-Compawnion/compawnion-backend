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
const storage = admin.storage().bucket('gs://compawnion-fbb5a.appspot.com');

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// MIDDLEWARES

// Middleware to parse JSON bodies
app.use(
  express.json({
    limit: "50mb",
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: "50mb",
  })
);

// Cors Middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  console.log(`${req.method} "${req.path}" from ${req.ip}`);
  next();
});

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ROUTES

const adminRoute = require("./ROUTES/Admins")(db, storage);
const applicationRoute = require("./ROUTES/application")(db, storage);
const compawnionRoute = require("./ROUTES/Compawnions")(db, storage);
const raRoute = require("./ROUTES/ra")(db, storage);
const superadminRoute = require("./ROUTES/superadmin")(db, storage);
const adoptedAnimalsRoute = require("./ROUTES/adoptedAnimals")(db, storage);
const pdfcontractRoute = require("./ROUTES/pdfcontract")(db, storage);


app.use("/Admins", adminRoute);
app.use("/application", applicationRoute);
app.use("/Compawnions", compawnionRoute);
app.use("/ra", raRoute);
app.use("/superadmin", superadminRoute);
app.use("/adoptedAnimals", adoptedAnimalsRoute);
app.use("/pdfcontract", pdfcontractRoute);




// Root route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to BarkCode API using Node.js and Express!" });
});

// Media routes
const mediaRoutes = [
  'Admins',
  'RescuedAnimals'
];
for (const route of mediaRoutes) {
  app.get(`/media/${route}/:id`, (req, res) => {
    const { id } = req.params;
    const file = storage.file(`${route}/${id}`);
    file.createReadStream()
      .on('error', (err) => {
        console.error(err);
        res.status(404).json({ message: "File not found." });
      })
      .pipe(res);
  });
};

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
