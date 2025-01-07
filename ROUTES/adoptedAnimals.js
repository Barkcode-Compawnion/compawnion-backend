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
      res
        .status(500)
        .json({ message: "Error retrieving adopted animals", error });
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

  // Endpoint to add a update an adopted animal
  adoptedAnimals.put("/:appPetID/:petId", async (req, res) => {
    const { appPetID, petId } = req.params;
    const updatedData = req.body;

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
        return res
          .status(404)
          .json({ message: "Pet not found in this adoption" });
      }

      // Update the specific pet data
      const updatedPetData = { ...petData, ...updatedData };
      await adoptedAnimalRef.update({
        [petId]: updatedPetData,
      });

      res.json({ message: "Adopted animal updated successfully", petId, ...updatedPetData });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error updating adopted animal", error });
    }
  });

  // Endpoint to add archive an adopted animal
  // Endpoint to archive an adopted animal
  adoptedAnimals.post("/archive/:appPetID/:petId", async (req, res) => {
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
        return res
          .status(404)
          .json({ message: "Pet not found in this adoption" });
      }

      // Add pet data to PET_ARCHIVE collection
      await db.collection("PET_ARCHIVE").doc(petId).set({
        ...petData,
        status: "Archived",
        archiveDate: new Date().toISOString(),
      });

      // Remove the pet from the AdoptedAnimals document
      const updatedData = doc.data();
      delete updatedData[petId];

      if (Object.keys(updatedData).length === 0) {
        // If no pets remain, delete the entire document
        await adoptedAnimalRef.delete();
      } else {
        // Otherwise, update the document with the remaining pets
        await adoptedAnimalRef.set(updatedData);
      }

      res.json({ message: "Adopted animal archived successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error archiving adopted animal", error });
    }
  });

  return adoptedAnimals;
};
