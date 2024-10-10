const express = require("express");
const Compawnions = express.Router();
module.exports = function (db) {
  async function getNextcompId() {
    const counterRef = db.collection("CompawnionsCounter").doc("CompIDCounter");

    try {
      // Use a Firestore transaction to safely increment the Companion ID counter
      const newCompId = await db.runTransaction(async (transaction) => {
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

      return newCompId;
    } catch (error) {
      console.error("Error generating new Companion ID:", error);
      throw error;
    }
  }

  Compawnions.post("/", async (req, res) => {
    const compData = req.body;
    console.log("Received data:", compData); // Log received data

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
      } = compData; // Use compData directly

      // Get the next auto-incremented Companion ID
      const compId = await getNextcompId();

      // Format the Companion ID to include leading zeros (e.g., 000-001)
      const formattedCompId = compId.toString().padStart(3, "0");

      // Prepare the new companion document
      const newCompanion = {
        ...compData,
        compId: formattedCompId, // Add the Companion ID to the document data
      };

      // Add the new companion document to Firestore
      await db.collection("Compawnions").doc(formattedCompId).set(newCompanion);

      console.log(`Document added with Companion ID: ${formattedCompId}`);
      res
        .status(201)
        .send({ message: `Companion added with ID: ${formattedCompId}` });
    } catch (error) {
      console.error("Error adding new companion:", error);
      res
        .status(500)
        .send({
          message: "Failed to add new companion.",
          error: error.message,
        });
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
