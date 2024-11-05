const express = require("express");
const ra = express.Router();

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {import('@google-cloud/storage').Bucket} storage
 * @returns {express.Router}
 */
module.exports = function (db, storage) {
  // Function to get and increment the next Pet ID atomically
  async function getNextPetId() {
    const counterRef = db.collection("Counter").doc("PetIDCounter");

    try {
      // Use a Firestore transaction to safely increment the Pet ID counter
      const newPetId = await db.runTransaction(async (transaction) => {
        const counterDoc = await transaction.get(counterRef);

        if (!counterDoc.exists) {
          // Initialize counter document if it doesn't exist
          transaction.set(counterRef, { currentId: 1 });
          return 1;
        }

        // Get the current ID value and increment by 1
        const currentId = counterDoc.data().currentId || 0;
        const updatedId = currentId + 1;

        // Update the counter document with the new ID value
        transaction.update(counterRef, { currentId: updatedId });

        return updatedId;
      });

      return newPetId;
    } catch (error) {
      console.error("Error generating new Pet ID:", error);
      throw error;
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  ra.post("/", async (req, res) => {
    const petData = req.body;

    try {
      const {
        personal: {
          picture: Image,
          name,
          type,
          age: { month, year },
          breed,
          weight,
          size,
          gender,
        },
        background: {
          personality,
          backgroundStory,
          vaccination: { vaccinationDate, vaccinationExp },
          medicalHistory: { medicalDate, medicalCert },
          rescueDate,
          adoptionDate,
          Status,
        },
        rfid,
      } = petData; // Use petData directly

      console.log("Received data:", petData); // Log received data

      // Translate Image into blob
      let Picture = null;
      if (Image) {
        try {
          // Create a buffer from the base64 string
          const type = Image.match(
            /data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/
          )[1];
          const data = Image.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(data, "base64");

          // Get the next auto-incremented Pet ID
          const petId = await getNextPetId();

          // Format the Pet ID to include leading zeros (e.g., 000-001)
          const formattedPetId = petId.toString().padStart(3, "0");

          // Upload the image to Firebase Storage
          const file = storage.file(
            `RescuedAnimals/${formattedPetId}.${type.split("/")[1]}`
          );
          await file.save(buffer, { contentType: type });
          Picture = `gs://compawnion-fbb5a.appspot.com/RescuedAnimals/RescuedAnimals/${formattedPetId}.${
            type.split("/")[1]
          }`;

          // Add the new pet document with the auto-incremented Pet ID as the document ID
          await db
            .collection("RescuedAnimals")
            .doc(formattedPetId)
            .set({
              ...petData,
              petId: formattedPetId,
              personal: {
                ...petData.personal,
                picture: Picture, // Save the URL of the uploaded image
              },
            });

          console.log(`Document added with Pet ID: ${formattedPetId}`);

          // Respond with success after adding the pet
          return res
            .status(200)
            .send({ message: `Pet added with ID: ${formattedPetId}` });
        } catch (error) {
          console.error("Error uploading image:", error);
          return res.status(500).json({ message: "Failed to upload image." });
        }
      }
    } catch (error) {
      console.error("Error adding new pet:", error);
      return res
        .status(500)
        .send({ message: "Failed to add new pet.", error: error.message });
    }
  });

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // In ra.js
  ra.post("/transfer/:id", async (req, res) => {
    const petId = req.params.id;

    try {
      const rescuedRef = db.collection("RescuedAnimals").doc(petId);
      const doc = await rescuedRef.get();

      if (!doc.exists) {
        return res
          .status(404)
          .json({ message: "Pet not found in RescuedAnimals" });
      }

      // Get the pet data and set it in the AdoptedAnimals collection
      const petData = doc.data();
      await db
        .collection("AdoptedAnimals")
        .doc(petId)
        .set({
          ...petData,
          adoptionDate: new Date().toISOString(), // Add adoption date if needed
          status: "Adopted",
        });

      // Remove the pet from RescuedAnimals after transfer
      await rescuedRef.delete();

      res.json({ message: "Pet successfully transferred to AdoptedAnimals" });
    } catch (error) {
      console.error("Error transferring pet:", error);
      res.status(500).json({ message: "Error transferring pet", error });
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
  ra.delete("/:id", async (req, res) => {
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
};
