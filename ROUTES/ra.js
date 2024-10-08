const express = require("express");
const ra = express.Router();

module.exports = function (db) {
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
ra.post("/", async (req, res) => {
    try {
      const {
        rfid,
        picture,
        name,
        type,
        breed,
        age,
        size,
        personality,
        backgroundStory,
        vaccinations,
        medicalHistory,
      } = req.body;
      const newUser = {
        rfid,
        picture,
        name,
        type,
        breed,
        age,
        size,
        personality,
        backgroundStory,
        vaccinations,
        medicalHistory,
      };
      const userRef = await db.collection("RescuedAnimals").add(newUser);
      res.status(201).json({ id: userRef.id, ...newUser });
    } catch (error) {
      res.status(500).json({ message: "Error adding animals", error });
    }
  });
  
  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  ra.get("/", async (req, res) => {
    try {
      const snapshot = await db.collection("RescuedAnimals").get();
      const users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Error retrieving Animals", error });
    }
  });
  
  ra.get("/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const userRef = db.collection("RescuedAnimals").doc(userId);
      const doc = await userRef.get();
  
      if (!doc.exists) {
        res.status(404).json({ message: "pet not found" });
      } else {
        res.json({ id: doc.id, ...doc.data() });
      }
    } catch (error) {
      res.status(500).json({ message: "Error retrieving pet", error });
    }
  });
  
  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  ra.put("/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const userRef = db.collection("RescuedAnimals").doc(userId);
      const updatedUser = req.body;
      await userRef.update(updatedUser);
      res.json({ message: "Pet updated successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error updating Pet", error });
    }
  });
  
  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  ra.delete("/ /:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const userRef = db.collection("RescuedAnimals").doc(userId);
      await userRef.delete();
      res.json({ message: "Pet deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error deleting Pet", error });
    }
  });
  
  return ra;
}
