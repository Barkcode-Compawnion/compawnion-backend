const express = require("express");
const adoptedAnimals = express.Router();

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {import('@google-cloud/storage').Bucket} storage
 * @returns {express.Router}
 */
module.exports = function (db, storage) {
  // retrieves all pets under their respective appPetIDs
  adoptedAnimals.get("/", async (req, res) => {
    try {
      const snapshot = await db.collection("AdoptedAnimals").get();
      const animals = snapshot.docs.map((doc) => ({
        appPetID: doc.id,
        pets: doc.data(),
      }));
      res.json(animals);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error retrieving adopted animals", error });
    }
  });

  // retrieves a specific pet by appPetID and petId
  adoptedAnimals.get("/:appPetID/:petId", async (req, res) => {
    const { appPetID, petId } = req.params;

    try {
      // Fetch the AdoptedAnimals document by appPetID
      const adoptedAnimalRef = db.collection("AdoptedAnimals").doc(appPetID);
      const doc = await adoptedAnimalRef.get();

      if (!doc.exists) {
        return res.status(404).json({ message: "Adopted animal not found" });
      }

      // Fetch the specific pet by its petId
      const petData = doc.data()[petId];

      if (!petData) {
        return res
          .status(404)
          .json({ message: "Pet not found in this adoption" });
      }

      res.json({ petId, ...petData });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error retrieving adopted animal", error });
    }
  });

  adoptedAnimals.get("/:appPetID", async (req, res) => {
    const { appPetID } = req.params;

    try {
      // Fetch the AdoptedAnimals document by appPetID
      const adoptedAnimalRef = db.collection("AdoptedAnimals").doc(appPetID);
      const doc = await adoptedAnimalRef.get();

      if (!doc.exists) {
        return res.status(404).json({ message: "Adopted animal not found" });
      }

      // Return the document data along with the appPetID
      res.json({ appPetID, ...doc.data() });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error retrieving adopted animal", error });
    }
  });

  return adoptedAnimals;
};
