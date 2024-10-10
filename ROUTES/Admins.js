const express = require("express");
const Admins = express.Router();

module.exports = function (db) {
  //  CRUD FOR ADMIN

  // Function to get and increment the next Admin ID automically
  async function getNextAdminId() {
    const counterRef = db.collection("AdminCounter").doc("AdminIDCounter");

    try {
      // Use a Firestore transaction to safely increment the Admin ID counter
      const newAdminId = await db.runTransaction(async (transaction) => {
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

      return newAdminId;
    } catch (error) {
      console.error("Error generating new Pet ID:", error);
      throw error;
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // create

  Admins.post("/", async (req, res) => {
    const AdminData = req.body;

    try {
      const { ID, Username, Password, Email, Mobilenumber, Position } =
        req.body;
      console.log("Received data:", AdminData); // Log received data
      const newUser = { ID, Username, Password, Email, Mobilenumber, Position };

      try {
        console.log("Generating next Admin ID...");
        const AdminId = await getNextAdminId(); // Call to get next Admin ID

        if (AdminId === undefined) {
          console.error("Admin ID is undefined.");
          return res
            .status(500)
            .send({ message: "Failed to generate Admin ID." });
        }

        const formattedAdminId = AdminId.toString().padStart(3, "0");
        console.log(`Formatted Admin ID: ${formattedAdminId}`);

        // Add the new pet document with the auto-incremented Admin ID
        await db
          .collection("Admins")
          .doc(formattedAdminId)
          .set({
            ...newUser,
            AdminId: formattedAdminId, // Include the formatted Admin ID
          });

        console.log(`Document added with Pet ID: ${formattedAdminId}`);
        res
          .status(200)
          .send({ message: `Pet added with ID: ${formattedAdminId}` });
      } catch (error) {
        console.error("Error while adding new Admin:", error);
        res.status(500).send({ message: "Failed to add new Admin.", error });
      }
    } catch (error) {
      console.error("Error occurred while processing the request:", error);
      res.status(500).json({ message: "Error adding an Admin", error });
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
