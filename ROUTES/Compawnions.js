const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const Compawnions = express.Router();

const secretKey = "sikretolangto"; // Replace with your secret key

module.exports = function (db) {
  async function getNextCompId() {
    const counterRef = db.collection("Counter").doc("CompIDCounter");

    try {
      const newCompId = await db.runTransaction(async (transaction) => {
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

      return newCompId;
    } catch (error) {
      console.error("Error generating new Companion ID:", error);
      throw new Error("Failed to generate new Companion ID.");
    }
  }
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // Register Companion
  Compawnions.post("/register", async (req, res) => {
    const {
      accountCreate: { Username, Email, Phone, Password, Verify },
      MedSched: { SchedTitle, SchedDate, SchedTime, SchedVetClinic, SchedPet },
      TrustedVet: { TVVetClinic, TVAddress },
      CompawnionSched: { EventTitle, CSDate, CSTime, GmeetRoom },
    } = req.body;

    try {
      // Check if the username already exists
      const existingUserSnapshot = await db
        .collection("Compawnions")
        .where("CompawnionUser.accountCreate.Username", "==", Username)
        .get();

      if (!existingUserSnapshot.empty) {
        return res.status(400).json({ message: "Username already exists." });
      }

      // Hash the password before storing it
      const hashedPassword = await bcrypt.hash(Password, 10); // Correct variable name to 'Password'

      // Call to get the next Companion ID
      const compId = await getNextCompId();
      const formattedCompId = compId.toString().padStart(3, "0");

      // Create token after the user is registered
      const token = jwt.sign({ Username }, secretKey, { expiresIn: "1h" }); // Use 'Username' instead of 'UserUsername'

      // Add the new Companion document
      await db
        .collection("Compawnions")
        .doc(formattedCompId)
        .set({
          CompawnionUser: {
            accountCreate: { Username, Email, Phone, Password: hashedPassword, Verify }, // Ensure Password is hashed
            MedSched: {
              SchedTitle,
              SchedDate,
              SchedTime,
              SchedVetClinic,
              SchedPet,
            },
            TrustedVet: { TVVetClinic, TVAddress },
            CompawnionSched: { EventTitle, CSDate, CSTime, GmeetRoom },
          },
          Status: "Inactive", // Set initial status to Inactive
          LastLogin: null, // Placeholder for last login
          LastLogout: null, // Placeholder for last logout
        });

      res.status(201).json({
        message: `Companion registered successfully with ID: ${formattedCompId}`,
        token, // Return token with the response
      });
    } catch (error) {
      console.error("Error registering companion:", error);
      res.status(500).json({ message: "Failed to register companion." });
    }
  });

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // Login Companion
  Compawnions.post("/login", async (req, res) => {
    const { Username, Password } = req.body;

    try {
      // Retrieve the user based on the provided username
      const userSnapshot = await db
        .collection("Compawnions")
        .where("CompawnionUser.accountCreate.Username", "==", Username) // Correct path to the username
        .get();

      // Check if the user exists
      if (userSnapshot.empty) {
        return res.status(404).json({ message: "User not found." });
      }

      // Get the user data
      const userData = userSnapshot.docs[0].data();

      // Compare the provided password with the hashed password stored in Firestore
      const isMatch = await bcrypt.compare(
        Password,
        userData.CompawnionUser.Password
      ); // Adjusted path to Password

      if (!isMatch) {
        return res.status(401).json({ message: "Invalid credentials." });
      }

      // Update the user's status and last login timestamp
      const loginTimestamp = new Date().toISOString();
      await userSnapshot.docs[0].ref.update({
        Status: "Active",
        LastLogin: loginTimestamp,
      });

      // Return the token for the logged-in user
      res.json({ token: userData.token });
    } catch (error) {
      console.error("Error logging in:", error);
      res.status(500).json({ message: "Failed to log in." });
    }
  });
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // Logout Companion
  Compawnions.post("/logout", async (req, res) => {
    const { Username } = req.body;

    if (!Username) {
      return res.status(400).json({ message: "Username is required." });
    }

    try {
      // Retrieve the user based on the Username
      const userSnapshot = await db
        .collection("Compawnions")
        .where("CompawnionUser.accountCreate.Username", "==", Username)
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
      res.status(500).json({ message: "Failed to log out." });
    }
  });
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // Read All Companions
  Compawnions.get("/", async (req, res) => {
    try {
      const snapshot = await db.collection("Compawnions").get();
      const companions = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      res.json({
        message: "Companions retrieved successfully.",
        data: companions,
      });
    } catch (error) {
      res.status(500).json({ message: "Error retrieving Companions." });
    }
  });

  // Read a specific Companion by ID
  Compawnions.get("/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const userRef = db.collection("Compawnions").doc(userId);
      const doc = await userRef.get();

      if (!doc.exists) {
        return res.status(404).json({ message: "Companion not found." });
      }
      res.json({
        message: "Companion retrieved successfully.",
        data: { id: doc.id, ...doc.data() },
      });
    } catch (error) {
      res.status(500).json({ message: "Error retrieving Companion." });
    }
  });
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // Update Companion
  Compawnions.put("/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const userRef = db.collection("Compawnions").doc(userId);
      const updatedUser = req.body;
      await userRef.update(updatedUser);
      res.json({ message: "Companion updated successfully." });
    } catch (error) {
      res.status(500).json({ message: "Error updating Companion." });
    }
  });
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // Delete Companion
  Compawnions.delete("/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const userRef = db.collection("Compawnions").doc(userId);
      await userRef.delete();
      res.json({ message: "Companion deleted successfully." });
    } catch (error) {
      res.status(500).json({ message: "Error deleting Companion." });
    }
  });

  return Compawnions;
};
