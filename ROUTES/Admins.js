const express = require("express");
const Admins = express.Router();

module.exports = function (db) {
  //  CRUD FOR ADMIN

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // create

  Admins.post("/", async (req, res) => {
    try {
      const { ID, Username, Password, Email, Mobilenumber, Position } =
        req.body;
      const newUser = { ID, Username, Password, Email, Mobilenumber, Position };
      const userRef = await db.collection("Admins").add(newUser);
      res.status(201).json({ id: userRef.id, ...newUser });
    } catch (error) {
      res.status(500).json({ message: "Error creating Admin", error });
    }
  });

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //   read

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
  //   update

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
  // delete

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
