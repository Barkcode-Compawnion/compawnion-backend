const express = require("express");
const adoptedAnimals = express.Router();

module.exports = function (db) {
  adoptedAnimals.get("/", async (req, res) => {
    try {
      const snapshot = await db.collection("AdoptedAnimals").get();
      const animals = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      res.json(animals);
    } catch (error) {
      res.status(500).json({ message: "Error retrieving adopted animals", error });
    }
  });

  adoptedAnimals.get("/:id", async (req, res) => {
    try {
      const animalId = req.params.id;
      const animalRef = db.collection("AdoptedAnimals").doc(animalId);
      const doc = await animalRef.get();

      if (!doc.exists) {
        res.status(404).json({ message: "Adopted animal not found" });
      } else {
        res.json({ id: doc.id, ...doc.data() });
      }
    } catch (error) {
      res.status(500).json({ message: "Error retrieving adopted animal", error });
    }
  });

  return adoptedAnimals;
};
