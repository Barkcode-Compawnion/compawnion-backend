const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const cron = require("node-cron");
const Admins = express.Router();

const secretKey = "sikretolangto"; // Replace with your secret key

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {import('@google-cloud/storage').Bucket} storage
 * @returns {express.Router}
 */
module.exports = function (db, storage) {
  async function getNextAdminId() {
    /* ID generation logic here */
  }

  // Register a new admin
  // Request body: {
  //   Name: String,
  //   Picture: String (base64 image string),
  //   Username: String,
  //   Password: String,
  //   Email: String,
  //   Mobilenumber: String,
  //   Branches: Array
  // }
  // Success response: { message: String, token: String }
  // Error response: { message: String }
  Admins.post("/register", async (req, res) => {
    const {
      Name,
      Picture: Image,
      Username,
      Password,
      Email,
      Mobilenumber,
      Branches,
    } = req.body;

    if (
      !Name ||
      !Username ||
      !Password ||
      !Email ||
      !Mobilenumber ||
      !Branches
    ) {
      return res.status(400).json({ message: "All fields are required." });
    }

    let Picture = null;
    if (Image) {
      try {
        const type = Image.match(
          /data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/
        )[1];
        const data = Image.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(data, "base64");

        const file = storage.file(`Admins/${Username}.${type.split("/")[1]}`);
        await file.save(buffer, { contentType: type });
        Picture = `https://firebasestorage.googleapis.com/v0/b/YOUR_PROJECT_ID/o/Admins%2F${Username}.${
          type.split("/")[1]
        }?alt=media`;
      } catch (error) {
        return res.status(500).json({ message: "Failed to upload image." });
      }
    }

    try {
      const existingUserSnapshot = await db
        .collection("Admins")
        .where("Username", "==", Username)
        .get();
      if (!existingUserSnapshot.empty) {
        return res.status(400).json({ message: "Username already exists." });
      }

      const hashedPassword = await bcrypt.hash(Password, 10);
      const token = jwt.sign({ Username }, secretKey, { expiresIn: "1h" });
      const AdminId = await getNextAdminId();
      const formattedAdminId = AdminId.toString().padStart(3, "0");

      await db
        .collection("Admins")
        .doc(formattedAdminId)
        .set({
          aStaffInfo: {
            Name,
            Picture,
            Username,
            Password: hashedPassword,
            Email,
            Mobilenumber,
            Branches,
          },
          token,
          LastLogin: null,
          LastLogout: null,
        });

      res.status(201).json({
        message: `Staff registered successfully with ID: ${formattedAdminId}`,
        token,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to register staff." });
    }
  });

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Login Admin
  // Request body: { Username: String (optional if Email is provided), Email: String (optional if Username is provided), Password: String }
  // Success response: { token: String }
  // Error response: { message: String }
  Admins.post("/login", async (req, res) => {
    const { Username, Password, Email } = req.body;

    if ((!Username && !Email) || !Password) {
      return res
        .status(400)
        .json({ message: "Username or Email, and Password are required." });
    }

    try {
      let userSnapshot;
      if (Username) {
        userSnapshot = await db
          .collection("Admins")
          .where("aStaffInfo.Username", "==", Username)
          .get();
      }
      if (!userSnapshot || userSnapshot.empty) {
        if (Email) {
          userSnapshot = await db
            .collection("Admins")
            .where("aStaffInfo.Email", "==", Email)
            .get();
        }
      }
      if (!userSnapshot || userSnapshot.empty) {
        return res.status(404).json({ message: "User not found." });
      }

      const userData = userSnapshot.docs[0].data();
      const isMatch = await bcrypt.compare(
        Password,
        userData.aStaffInfo.Password
      );
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid credentials." });
      }

      const loginTimestamp = new Date().toISOString();
      const token = jwt.sign(
        { Username: userData.aStaffInfo.Username },
        secretKey,
        { expiresIn: "1h" }
      );
      await userSnapshot.docs[0].ref.update({
        LastLogin: loginTimestamp,
        token,
      });

      res.json({ token });
    } catch (error) {
      res.status(500).json({ message: "Failed to log in." });
    }
  });

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Logout Admin
  // Request body: { Username: String (optional if Email is provided), Email: String (optional if Username is provided) }
  // Success response: { message: String }
  // Error response: { message: String }
  Admins.post("/logout", async (req, res) => {
    const { Username, Email } = req.body;

    if (!Username && !Email) {
      return res
        .status(400)
        .json({ message: "Username or Email is required." });
    }

    try {
      let userSnapshot;
      if (Username) {
        userSnapshot = await db
          .collection("Admins")
          .where("aStaffInfo.Username", "==", Username)
          .get();
      }
      if (!userSnapshot || userSnapshot.empty) {
        if (Email) {
          userSnapshot = await db
            .collection("Admins")
            .where("aStaffInfo.Email", "==", Email)
            .get();
        }
      }
      if (!userSnapshot || userSnapshot.empty) {
        return res.status(404).json({ message: "User not found." });
      }

      await userSnapshot.docs[0].ref.update({
        LastLogout: new Date().toISOString(),
      });

      res.json({ message: "Logout successful." });
    } catch (error) {
      res.status(500).json({ message: "Failed to log out." });
    }
  });

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Read All Admins
  // Success response: Array of Admin objects
  // Error response: { message: String }
  Admins.get("/", async (req, res) => {
    try {
      const snapshot = await db.collection("Admins").get();
      const users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Error retrieving Admins" });
    }
  });

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Get My Profile
  // Header: { Authorization: Bearer Token }
  // Success response: { id: String, ...Admin object }
  // Error response: { message: String }
  Admins.get("/me", async (req, res) => {
    const { authorization } = req.headers;

    if (!authorization) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authorization.split(" ")[1];

    try {
      const decoded = jwt.verify(token, secretKey);
      const userSnapshot = await db
        .collection("Admins")
        .where("aStaffInfo.Username", "==", decoded.Username)
        .get();

      if (userSnapshot.empty) {
        return res.status(404).json({ message: "User not found." });
      }

      const userData = userSnapshot.docs[0].data();
      res.json({ id: userSnapshot.docs[0].id, ...userData });
    } catch (error) {
      res.status(500).json({ message: "Error retrieving profile" });
    }
  });

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Read a specific Admin by ID
  // Success response: { id: String, ...Admin object }
  // Error response: { message: String }
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
      res.status(500).json({ message: "Error retrieving Admins" });
    }
  });

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Update Admin
  // Request body: {userId: String}
  // Success response: { message: String }
  // Error response: { message: String }
  Admins.put("/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const userRef = db.collection("Admins").doc(userId);
      const updatedUser = req.body;

      const { Picture: Image } = req.body;

      let Picture = null;
      if (Image) {
        try {
          const type = Image.match(
            /data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/
          )[1];
          const data = Image.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(data, "base64");

          const file = storage.file(`Admins/${userId}.${type.split("/")[1]}`);
          await file.save(buffer, { contentType: type });
          Picture = `https://firebasestorage.googleapis.com/v0/b/YOUR_PROJECT_ID/o/Admins%2F${userId}.${
            type.split("/")[1]
          }?alt=media`;
          updatedUser.aStaffInfo.Picture = Picture;
        } catch (error) {
          return res.status(500).json({ message: "Failed to upload image." });
        }
      }

      await userRef.update(updatedUser);
      res.json({ message: "Admin updated successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error updating Admin" });
    }
  });

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Delete Admin
  // Request body: {userId: String}
  // Success response: { message: String }
  // Error response: { message: String }
  Admins.delete("/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const userRef = db.collection("Admins").doc(userId);

      const doc = await userRef.get();
      if (!doc.exists) {
        return res.status(404).json({ message: "Admin not found" });
      }

      await userRef.delete();
      res.json({ message: "Admin deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error deleting Admin" });
    }
  });

  return Admins;
};
