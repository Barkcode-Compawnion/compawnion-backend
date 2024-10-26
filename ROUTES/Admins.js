const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const cron = require("node-cron");
const Admins = express.Router();

const secretKey = "sikretolangto"; // Replace with your secret key

module.exports = function (db) {
  // Function to get and increment the next Admin ID automatically
  async function getNextAdminId() {
    const counterRef = db.collection("Counter").doc("AdminIDCounter");

    try {
      const newAdminId = await db.runTransaction(async (transaction) => {
        const counterDoc = await transaction.get(counterRef);

        if (!counterDoc.exists) {
          transaction.set(counterRef, { currentId: 1 });
          return 1;
        }

        const currentId = counterDoc.data().currentId || 0;
        const updatedId = currentId + 1;
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
  // Create Admin

  Admins.post("/register", async (req, res) => {
    const { Name, Picture, Username, Password, Email, Mobilenumber } = req.body;

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
      const token = jwt.sign({ Username }, secretKey, { expiresIn: "1h" });

      // Call to get the next Admin ID
      const AdminId = await getNextAdminId();
      const formattedAdminId = AdminId.toString().padStart(3, "0");

      // Add the new Admin document without saving AdminId
      await db
        .collection("Admins")
        .doc(formattedAdminId)
        .set({
          aStaffInfo: {
            Name,
            Picture,
            Username,
            Password: hashedPassword, // Store the hashed password
            Email,
            Mobilenumber,
          },
          token,
          LastLogin: null, // Placeholder for last login
          LastLogout: null, // Placeholder for last logout
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
  // Login Admin

  Admins.post("/login", async (req, res) => {
    const { Username, Password } = req.body;
    console.log(`Login attempt for username: ${Username}`); // Log the username

    try {
      // Retrieve the user based on the provided username
      const userSnapshot = await db
        .collection("Admins")
        .where("aStaffInfo.Username", "==", Username)
        .get();
      console.log(
        `User snapshot found: ${userSnapshot.docs.length} document(s)`
      );

      // Check if the user exists
      if (userSnapshot.empty) {
        console.log("No user found with this username.");
        return res.status(404).json({ message: "User not found." });
      }

      // Get the user data
      const userData = userSnapshot.docs[0].data();

      // Compare the provided password with the hashed password stored in Firestore
      const isMatch = await bcrypt.compare(
        Password,
        userData.aStaffInfo.Password
      );

      if (!isMatch) {
        console.log("Invalid credentials.");
        return res.status(401).json({ message: "Invalid credentials." });
      }

      // Update the user's last login timestamp
      const loginTimestamp = new Date().toISOString();
      const token = jwt.sign({ Username }, secretKey, { expiresIn: "1h" });

      await userSnapshot.docs[0].ref.update({
        LastLogin: loginTimestamp,
        token,
      });

      // Return the token for the logged-in user
      res.json({ token });
    } catch (error) {
      console.error("Error logging in:", error);
      res.status(500).json({ message: "Failed to log in.", error });
    }
  });

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Logout Admin

  Admins.post("/logout", async (req, res) => {
    const { Username } = req.body; // Get the Username from the request body

    if (!Username) {
      return res.status(400).json({ message: "Username is required." });
    }

    try {
      // Retrieve the user based on the Username
      const userSnapshot = await db
        .collection("Admins")
        .where("aStaffInfo.Username", "==", Username)
        .get();

      if (userSnapshot.empty) {
        return res.status(404).json({ message: "User not found." });
      }

      // Set the LastLogout timestamp
      await userSnapshot.docs[0].ref.update({
        LastLogout: new Date().toISOString(), // Record the time of logout
      });

      res.json({ message: "Logout successful." });
    } catch (error) {
      console.error("Error logging out:", error);
      res.status(500).json({ message: "Failed to log out.", error });
    }
  });

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Read All Admins

  Admins.get("/", async (req, res) => {
    try {
      const snapshot = await db.collection("Admins").get();
      const users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Error retrieving Admins", error });
    }
  });

  // Read a specific Admin by ID
  Admins.get("/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const userRef = db.collection("Admins").doc(userId);
      const doc = await userRef.get();

      if (!doc.exists) {
        return res.status(404).json({ message: "Admin not found" });
      }
      res.json({ id: doc.id, ...doc.data() });
    } catch (error) {
      res.status(500).json({ message: "Error retrieving Admins", error });
    }
  });

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Update Admin

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
  // Delete Admin

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
