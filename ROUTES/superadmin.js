const express = require("express");
const jwt = require("jsonwebtoken");

const Superadmins = express.Router();
const secretKey = "sikretolangto"; // Store in environment variables

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {import('@google-cloud/storage').Bucket} storage
 * @returns {express.Router}
 */
module.exports = function (db, storage) {
  // Login route for superadmin
  Superadmins.post("/login", async (req, res) => {
    const { Password } = req.body; // Only password input

    try {
      // Fetch the superadmin document from Firestore
      const superadminDoc = await db.collection("superadmin").doc("onlysuperadmin").get();

      if (!superadminDoc.exists) {
        return res.status(404).json({ message: "Superadmin not found." });
      }

      const { superadminpassword } = superadminDoc.data(); // Get the stored password

      // Compare the plain text passwords
      if (Password !== superadminpassword) {
        return res.status(401).json({ message: "Invalid credentials." });
      }

      // Generate a JWT token upon successful login
      const token = jwt.sign({ role: "superadmin" }, secretKey, { expiresIn: "2h" });

      res.json({ message: "Superadmin logged in successfully", token });
    } catch (error) {
      console.error("Error logging in superadmin:", error);
      res.status(500).json({ message: "Failed to log in.", error });
    }
  });

  return Superadmins;
};
