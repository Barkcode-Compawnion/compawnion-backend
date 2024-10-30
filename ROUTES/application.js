const express = require("express");
const application = express.Router();
const { generateAndSavePDF } = require("./pdfcontract"); // Import the PDF generation module

module.exports = function (db) {
  // Function to get and increment the next Application ID atomically
  async function getNextAppId() {
    const counterRef = db.collection("Counter").doc("AppIDCounter");

    try {
      const newAppId = await db.runTransaction(async (transaction) => {
        const counterDoc = await transaction.get(counterRef);

        if (!counterDoc.exists) {
          transaction.set(counterRef, { currentId: 1 });
          return 1;
        }

        const currentId = counterDoc.data().currentId || 0;
        const updatedId = currentId + 1;
        transaction.update(counterRef, { currentId: updatedId });

        return updatedId;
      });

      return newAppId;
    } catch (error) {
      console.error("Error generating new App ID:", error);
      throw error;
    }
  }

  // POST route to add a new application
  application.post("/", async (req, res) => {
    const appData = req.body; // Get the incoming data

    try {
      const {
        applicationType,
        agreement,
        paymentAgreement,
        schedules: { onlineInterview, onsiteVisit },
        petOwnershipExperience,
        dwelling: {
          petBreeds,
          planningToMoveOut,
          ownership,
          numberOfPets,
          petsAllowedInHouse,
          numberOfHouseMembers,
          dwellingType,
        },
        veterinaryClinicName,
        applicant,
        signature, // Include signature from request
      } = appData;

      console.log("Received data:", appData);

      // Get the next auto-incremented Application ID
      const appId = await getNextAppId();
      const formattedAppId = appId.toString().padStart(3, "0");

      const newApplication = {
        applicationType,
        agreement,
        paymentAgreement,
        applicationAppId: formattedAppId,
        schedules: { onlineInterview, onsiteVisit },
        petOwnershipExperience,
        dwelling: {
          petBreeds,
          planningToMoveOut,
          ownership,
          numberOfPets,
          petsAllowedInHouse,
          numberOfHouseMembers,
          dwellingType,
        },
        veterinaryClinicName,
        applicant,
      };

      // Add the new application document
      await db.collection("Application").doc(formattedAppId).set(newApplication);
      console.log(`Document added with Application ID: ${formattedAppId}`);

      // Generate and save the PDF after adding the application
      const pdfPath = await generateAndSavePDF(newApplication, signature);
      console.log(`PDF generated at: ${pdfPath}`);

      return res.status(201).send({ message: `Application added with ID: ${formattedAppId}`, pdfPath });
    } catch (error) {
      console.error("Error occurred while processing the request:", error);
      return res.status(500).json({ message: "Error adding an application", error: error.message });
    }
  });

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // GET route to retrieve all applications
  application.get("/", async (req, res) => {
    try {
      const snapshot = await db.collection("Application").get();
      const applications = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      res.json(applications);
    } catch (error) {
      console.error("Error retrieving applications:", error);
      res.status(500).json({ message: "Error retrieving applications", error });
    }
  });

  // GET route to retrieve a specific application by ID
  application.get("/:id", async (req, res) => {
    try {
      const appId = req.params.id;
      const appRef = db.collection("Application").doc(appId);
      const doc = await appRef.get();

      if (!doc.exists) {
        return res.status(404).json({ message: "Application not found" });
      }

      res.json({ id: doc.id, ...doc.data() });
    } catch (error) {
      console.error("Error retrieving application:", error);
      res.status(500).json({ message: "Error retrieving application", error });
    }
  });

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // PUT route to update a specific application by ID
  application.put("/:id", async (req, res) => {
    try {
      const appId = req.params.id;
      const appRef = db.collection("Application").doc(appId);
      const updatedData = req.body;

      const doc = await appRef.get();
      if (!doc.exists) {
        return res.status(404).json({ message: "Application not found" });
      }

      await appRef.update(updatedData);
      res.json({ message: "Application updated successfully" });
    } catch (error) {
      console.error("Error updating application:", error);
      return res.status(500).json({ message: "Error updating application", error: error.message });
    }
  });

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // DELETE route to remove a specific application by ID
  application.delete("/:id", async (req, res) => {
    try {
      const appId = req.params.id;
      const appRef = db.collection("Application").doc(appId);
      await appRef.delete();
      res.json({ message: "Application deleted successfully" });
    } catch (error) {
      console.error("Error deleting application:", error);
      res.status(500).json({ message: "Error deleting application", error });
    }
  });

  return application;
};
