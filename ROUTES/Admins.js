// etong route yung gagamitin sa paggawa ng mga admin or staff so eto 
// yung need iconnect sa mga fields ng superadmin desktop

const express = require("express");
const jwt = require("jsonwebtoken"); // Import jsonwebtoken
const bcrypt = require("bcrypt"); // Import bcrypt for hashing passwords
const Admins = express.Router();

const secretKey = "sikretolangto"; // Replace with your secret key

module.exports = function (db) {
  // CRUD FOR ADMIN

  // Function to get and increment the next Admin ID automatically
  async function getNextAdminId() {
    const counterRef = db.collection("Counter").doc("AdminIDCounter");

    try {
      // Use a Firestore transaction to safely increment the Admin ID counter
      const newAdminId = await db.runTransaction(async (transaction) => {
        const counterDoc = await transaction.get(counterRef);

        if (!counterDoc.exists) {
          // Initialize counter document if it doesn't exist
          transaction.set(counterRef, { currentId: 1 });
          return 1;
        }

        // Get the current ID value and increment by 1
        const currentId = counterDoc.data().currentId || 0;
        const updatedId = currentId + 1;

        // Update the counter document with the new ID value
        transaction.update(counterRef, { currentId: updatedId });

        return updatedId;
      });

      return newAdminId;
    } catch (error) {
      console.error("Error generating new Admin ID:", error);
      throw error;
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Create

  Admins.post("/register", async (req, res) => {
    const { Username, Password, Email, Mobilenumber, Position } = req.body;

    try {
      // Check if the username already exists
      const existingUserSnapshot = await db
        .collection("Admins")
        .where("Username", "==", Username)
        .get();

      if (!existingUserSnapshot.empty) {
        return res.status(400).json({ message: "Username already exists." });
      }

      // Hash the password before storing it
      const hashedPassword = await bcrypt.hash(Password, 10);

      // Generate a unique token for the user
      const token = jwt.sign({ Username }, secretKey, { expiresIn: "1h" });

      // Call to get the next Admin ID
      const AdminId = await getNextAdminId();
      const formattedAdminId = AdminId.toString().padStart(3, "0");

      // Add the new Admin document with the hashed password and token
      await db.collection("Admins").doc(formattedAdminId).set({
        Username,
        Password: hashedPassword, // Store the hashed password
        Email,
        Mobilenumber,
        Position,
        AdminId: formattedAdminId,
        token, // Store the generated token
      });

      res.status(201).json({
        message: `Staff registered successfully with ID: ${formattedAdminId}`,
        token,
      });
    } catch (error) {
      console.error("Error registering staff:", error);
      res.status(500).json({ message: "Failed to register staff.", error });
    }
  });

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Login

  Admins.post("/login", async (req, res) => {
    const { Username, Password } = req.body;

    try {
      // Fetch user by Username field
      const userSnapshot = await db
        .collection("Admins")
        .where("Username", "==", Username)
        .get();

      // Check if any user was found
      if (userSnapshot.empty) {
        return res.status(404).json({ message: "User not found." });
      }

      const userData = userSnapshot.docs[0].data(); // Get the first matching document

      // Check the password
      const isMatch = await bcrypt.compare(Password, userData.Password);
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid credentials." });
      }

      // Return the token if credentials are valid
      res.json({ token: userData.token });
    } catch (error) {
      console.error("Error logging in:", error);
      res.status(500).json({ message: "Failed to log in.", error });
    }
  });

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Read

  Admins.get("/", async (req, res) => {
    try {
      const snapshot = await db.collection("Admins").get();
      const users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Error retrieving Admins", error });
    }
  });

  Admins.get("/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const userRef = db.collection("Admins").doc(userId);
      const doc = await userRef.get();

      if (!doc.exists) {
        res.status(404).json({ message: "Admin not found" });
      } else {
        res.json({ id: doc.id, ...doc.data() });
      }
    } catch (error) {
      res.status(500).json({ message: "Error retrieving Admins", error });
    }
  });

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Update

  Admins.put("/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const userRef = db.collection("Admins").doc(userId);
      const updatedUser = req.body;
      await userRef.update(updatedUser);
      res.json({ message: "Admin updated successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error updating Admin", error });
    }
  });

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Delete

  Admins.delete("/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const userRef = db.collection("Admins").doc(userId);
      await userRef.delete();
      res.json({ message: "Admin deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error deleting Admin", error });
    }
  });

  return Admins;
};
