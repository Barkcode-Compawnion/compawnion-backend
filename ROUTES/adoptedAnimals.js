const express = require("express");
const adoptedAnimals = express.Router();

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {import('@google-cloud/storage').Bucket} storage
 * @returns {express.Router}
 */
module.exports = function (db, storage) {
  
  // Endpoint to get all adopted animals, showing all pets under their respective appPetIDs
  adoptedAnimals.get("/", async (req, res) => {
    try {
      const snapshot = await db.collection("AdoptedAnimals").get();
      const animals = snapshot.docs.map((doc) => ({
        appPetID: doc.id,
        pets: doc.data(),
      }));
      res.json(animals);
    } catch (error) {
      res.status(500).json({ message: "Error retrieving adopted animals", error });
    }
  });

  // Endpoint to get a specific adopted animal by appPetID and petId
  adoptedAnimals.get("/:appPetID/:petId", async (req, res) => {
    const { appPetID, petId } = req.params;

    try {
      // Fetch the AdoptedAnimals document by appPetID
      const adoptedAnimalRef = db.collection("AdoptedAnimals").doc(appPetID);
      const doc = await adoptedAnimalRef.get();

      if (!doc.exists) {
        return res.status(404).json({ message: "Adopted animal not found" });
      }

      // Fetch the specific pet by its petId field within the appPetID document
      const petData = doc.data()[petId];

      if (!petData) {
        return res.status(404).json({ message: "Pet not found in this adoption" });
      }

      res.json({ petId, ...petData });
    } catch (error) {
      res.status(500).json({ message: "Error retrieving adopted animal", error });
    }
  });

  return adoptedAnimals;
};
