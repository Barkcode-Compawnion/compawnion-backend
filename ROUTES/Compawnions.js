const express = require("express");
const Compawnions = express.Router();
module.exports = function (db) {
  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  Compawnions.post("/", async (req, res) => {
    try {
      const {
        UserAcctID,
        UserUsername,
        UserPassword,
        UserEmail,
        UserPhone,
        UserBday,
        UserAge,
        UserAddress,
        UserPetID,
        UserApplication,
      } = req.body;
      const comp = {
        UserAcctID,
        UserUsername,
        UserPassword,
        UserEmail,
        UserPhone,
        UserBday,
        UserAge,
        UserAddress,
        UserPetID,
        UserApplication,
      };
      const compRef = await db.collection("Compawnions").add(comp);
      res.status(201).json({ id: compRef.id, ...comp });
    } catch (error) {
      res.status(500).json({ message: "Error creating a User", error });
    }
  });

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  Compawnions.get("/", async (req, res) => {
    try {
      const snapshot = await db.collection("Compawnions").get();
      const users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Error retrieving Users", error });
    }
  });

  Compawnions.get("/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const userRef = db.collection("Compawnions").doc(userId);
      const doc = await userRef.get();

      if (!doc.exists) {
        res.status(404).json({ message: "User not found" });
      } else {
        res.json({ id: doc.id, ...doc.data() });
      }
    } catch (error) {
      res.status(500).json({ message: "Error retrieving User", error });
    }
  });

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  Compawnions.put("/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const userRef = db.collection("Compawnions").doc(userId);
      const updatedUser = req.body;
      await userRef.update(updatedUser);
      res.json({ message: "User updated successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error updating User", error });
    }
  });

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  Compawnions.delete("/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const userRef = db.collection("Compawnions").doc(userId);
      await userRef.delete();
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error deleting User", error });
    }
  });

  return Compawnions;
};
