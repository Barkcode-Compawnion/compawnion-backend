const express = require("express");
const nodemailer = require("nodemailer");
const application = express.Router();

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @returns {express.Router}
 */
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

  application.post("/:id/approve", async (req, res) => {
    const appId = req.params.id;

    try {
      // Get the next appPetID
      const appPetId = await getNextAppPetId();

      const appRef = db
        .collection("Applications")
        .doc("PENDING")
        .collection("Applications")
        .doc(appId);

      const appDoc = await appRef.get();
      if (!appDoc.exists) {
        return res.status(404).json({ message: "Application not found" });
      }

      const applicationData = appDoc.data();
      applicationData.status = "Approved"; // Update status
      applicationData.appPetID = appPetId; // Add auto-incremented appPetID

      // Move the application to the APPROVED collection
      await db
        .collection("Applications")
        .doc("APPROVED")
        .collection("Applications")
        .doc(appId)
        .set(applicationData);

      // Delete the application from the PENDING collection
      await appRef.delete();

      res.json({
        message: `Application approved, assigned appPetID ${appPetId} and moved to approved status`,
      });
    } catch (error) {
      console.error("Error approving application:", error);
      res
        .status(500)
        .json({ message: "Error approving application", error: error.message });
    }
  });

  // Function to get the next incremented appPetID
  async function getNextAppPetId() {
    const counterRef = db.collection("Counter").doc("AppPetIDCounter");

    try {
      const newAppPetId = await db.runTransaction(async (transaction) => {
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

      return newAppPetId;
    } catch (error) {
      console.error("Error generating new appPetID:", error);
      throw error;
    }
  }

  application.put("/:id/approve", async (req, res) => {
    const appId = req.params.id;

    try {
      const appRef = db
        .collection("Applications")
        .doc("PENDING")
        .collection("Applications")
        .doc(appId);

      const appDoc = await appRef.get();
      if (!appDoc.exists) {
        return res.status(404).json({ message: "Application not found" });
      }

      const applicationData = appDoc.data();
      applicationData.status = "Approved"; // Update status

      // Get the next available appPetID from the counter
      const counterRef = db.collection("Counter").doc("AppPetIDCounter");

      const newAppPetID = await db.runTransaction(async (transaction) => {
        const counterDoc = await transaction.get(counterRef);

        let currentAppPetID = 0;
        if (!counterDoc.exists) {
          // Initialize the counter if it doesn't exist
          transaction.set(counterRef, { currentAppPetID: 1 });
          currentAppPetID = 1;
        } else {
          currentAppPetID = counterDoc.data().currentAppPetID || 0;
          const updatedAppPetID = currentAppPetID + 1;
          transaction.update(counterRef, { currentAppPetID: updatedAppPetID });
        }

        return currentAppPetID;
      });

      // Add appPetID to the application data
      applicationData.appPetID = newAppPetID;

      // Move the application to the APPROVED collection
      await db
        .collection("Applications")
        .doc("APPROVED")
        .collection("Applications")
        .doc(appId)
        .set(applicationData);

      // Delete the application from the PENDING collection
      await appRef.delete();

      res.json({
        message: `Application approved, assigned appPetID ${newAppPetID} and moved to approved status`,
      });
    } catch (error) {
      console.error("Error approving application:", error);
      res
        .status(500)
        .json({ message: "Error approving application", error: error.message });
    }
  });

  application.put("/:id/reject", async (req, res) => {
    const appId = req.params.id;

    try {
      // Reference to the PENDING application document
      const appRef = db
        .collection("Applications")
        .doc("PENDING")
        .collection("Applications")
        .doc(appId);

      const appDoc = await appRef.get();
      if (!appDoc.exists) {
        return res
          .status(404)
          .json({ message: "Application not found in pending" });
      }

      const applicationData = appDoc.data();
      applicationData.status = "Rejected"; // Set status to "Rejected"

      // Move the application to the REJECT collection
      await db
        .collection("Applications")
        .doc("REJECT") // REJECT document
        .collection("Applications") // Sub-collection inside REJECT document
        .doc(appId) // Use the application ID as the document ID
        .set(applicationData); // Save the application data in REJECT collection

      // Delete the application from the PENDING collection
      await appRef.delete();

      res.json({ message: "Application rejected and moved to REJECT status" });
    } catch (error) {
      console.error("Error rejecting application:", error);
      res
        .status(500)
        .json({ message: "Error rejecting application", error: error.message });
    }
  });

  application.put("/:id/reject", async (req, res) => {
    const appId = req.params.id;

    try {
      const appRef = db
        .collection("Applications")
        .doc("PENDING")
        .collection("Applications")
        .doc(appId);

      const appDoc = await appRef.get();
      if (!appDoc.exists) {
        return res
          .status(404)
          .json({ message: "Application not found in pending" });
      }

      const applicationData = appDoc.data();
      applicationData.status = "Rejected";

      // Move to REJECT collection
      await db
        .collection("Applications")
        .doc("REJECT")
        .collection("Applications")
        .doc(appId)
        .set(applicationData);

      // Delete from PENDING
      await appRef.delete();

      res.json({ message: "Application rejected and moved to REJECT" });
    } catch (error) {
      console.error("Error rejecting application:", error);
      res
        .status(500)
        .json({ message: "Error rejecting application", error: error.message });
    }
  });

  application.delete("/reject/:id", async (req, res) => {
    const appId = req.params.id;

    try {
      const rejectedRef = db
        .collection("Applications")
        .doc("REJECT")
        .collection("Applications")
        .doc(appId);

      const rejectedDoc = await rejectedRef.get();
      if (!rejectedDoc.exists) {
        return res
          .status(404)
          .json({ message: "Application not found in reject" });
      }

      await rejectedRef.delete();
      res.json({ message: "Application deleted from REJECT collection" });
    } catch (error) {
      console.error("Error deleting application:", error);
      res
        .status(500)
        .json({ message: "Error deleting application", error: error.message });
    }
  });

  return application;
};
