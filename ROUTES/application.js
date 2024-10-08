const express = require("express");
const application = express.Router();
module.exports = function (db) {
  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  application.post("/", async (req, res) => {
    try {
      const {
        applicationType,
        agreement,
        paymentAgreement,
        ApplicationId,
        applicationpetId,
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
        applicant: {
          firstName,
          middleName,
          lastName,
          birthdate,
          occupation,
          contactInfo: {
            country,
            emailAddress,
            cityMunicipality,
            address,
            phoneNumber,
            province,
            baranggay,
            socialMediaLinks: { facebook, instagram },
          },
          validId,
        },
      } = req.body;
      const comp = {
        applicationType,
        agreement,
        paymentAgreement,
        ApplicationId,
        applicationpetId,
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
        applicant: {
          firstName,
          middleName,
          lastName,
          birthdate,
          occupation,
          contactInfo: {
            country,
            emailAddress,
            cityMunicipality,
            address,
            phoneNumber,
            province,
            baranggay,
            socialMediaLinks: { facebook, instagram },
          },
          validId,
        },
      };
      const compRef = await db.collection("Application").add(comp);
      res.status(201).json({ id: compRef.id, ...comp });
    } catch (error) {
      res.status(500).json({ message: "Error creating an Application", error });
    }
  });

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  application.get("/", async (req, res) => {
    try {
      const snapshot = await db.collection("Application").get();
      const users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Error retrieving Application", error });
    }
  });

  application.get("/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const userRef = db.collection("Application").doc(userId);
      const doc = await userRef.get();

      if (!doc.exists) {
        res.status(404).json({ message: "application not found" });
      } else {
        res.json({ id: doc.id, ...doc.data() });
      }
    } catch (error) {
      res.status(500).json({ message: "Error retrieving application", error });
    }
  });

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  application.put("/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const userRef = db.collection("Application").doc(userId);
      const updatedUser = req.body;
      await userRef.update(updatedUser);
      res.json({ message: "application updated successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error updating application", error });
    }
  });

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  application.delete("/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const userRef = db.collection("Application").doc(userId);
      await userRef.delete();
      res.json({ message: "Application deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error deleting an Application", error });
    }
  });

  return application;
};
