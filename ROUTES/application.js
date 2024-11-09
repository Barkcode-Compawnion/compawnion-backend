const express = require("express");
const nodemailer = require("nodemailer");
const application = express.Router();

module.exports = function (db) {
  // Configure nodemailer transporter with direct settings
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "barkcodecompawnion@gmail.com", // Replace with actual email
      pass: "fmji xuvs akpb mrke", // Replace with actual app password
    },
  });

  // Function to generate a random 5-digit appPetID
  async function getNextAppPetId() {
    // Generate a random 5-digit number between 10000 and 99999
    const appPetID = Math.floor(10000 + Math.random() * 90000);
    return appPetID;
  }

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

  application.post("/", async (req, res) => {
    const appData = req.body; // Includes applicant details and petId

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
        petId, // Get the petId from the request body
      } = appData;

      if (!petId) {
        return res.status(400).json({ message: "Pet ID is required" });
      }

      // Generate application ID
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
        petData: { id: petId }, // Include the petId here
        status: "Pending", // Set status to "Pending"
      };

      // Add the new application under "PENDING"
      const appRef = db
        .collection("Applications")
        .doc("PENDING")
        .collection("Applications")
        .doc(formattedAppId);

      await appRef.set(newApplication);
      console.log("Application added with ID:", formattedAppId);

      return res
        .status(201)
        .send({ message: `Application added with ID: ${formattedAppId}` });
    } catch (error) {
      console.error("Error occurred while processing the request:", error);
      return res
        .status(500)
        .json({ message: "Error adding application", error: error.message });
    }
  });

  application.get("/:id", async (req, res) => {
    const appId = req.params.id;

    try {
      // Fetch the application document directly from the "PENDING" document
      const appRef = db
        .collection("Applications")
        .doc("PENDING")
        .collection("Applications")
        .doc(appId); // Use the appId as document ID

      const appDoc = await appRef.get();

      if (!appDoc.exists) {
        return res.status(404).json({ message: "Application not found" });
      }

      const applicationData = appDoc.data();
      res.json({
        application: { id: appDoc.id, ...applicationData },
      });
    } catch (error) {
      console.error("Error retrieving application:", error);
      res.status(500).json({ message: "Error retrieving application", error });
    }
  });

  // Modified approve endpoint to use getNextAppPetId
  application.post("/:id/approve", async (req, res) => {
    const appId = req.params.id; // Get the application ID from the URL

    try {
      // Fetch the application document from the PENDING collection
      const appRef = db
        .collection("Applications")
        .doc("PENDING")
        .collection("Applications")
        .doc(appId);

      const appDoc = await appRef.get(); // Get the application data
      if (!appDoc.exists) {
        return res.status(404).json({ message: "Application not found" });
      }

      const applicationData = appDoc.data();
      const email = applicationData.applicant?.email; // Get applicant email

      if (!email) {
        return res.status(400).json({ message: "Applicant email not found" });
      }

      // **Check if petData.id exists in the application, if not, stop the process**
      const petId = applicationData.petData?.id; // petData.id is where the petId is stored
      if (!petId) {
        return res
          .status(400)
          .json({ message: "Pet ID is missing in the application." });
      }

      // Generate the next AppPetID
      const appPetID = await getNextAppPetId();
      applicationData.status = "Approved";
      applicationData.appPetID = appPetID;

      // Move the application to the APPROVED collection
      await db
        .collection("Applications")
        .doc("APPROVED")
        .collection("Applications")
        .doc(appId)
        .set(applicationData);

      // Delete the application from the PENDING collection
      await appRef.delete();

      // 1. Send the approval email (this comes before transferring the pet)
      await sendApprovalEmail(email, applicationData);

      // 2. Transfer the pet once the application is approved
      // Transfer the pet to AdoptedAnimals in Firestore with appPetID as the document ID and petId as a field
      const petRef = db.collection("RescuedAnimals").doc(petId); // Pet in RescuedAnimals collection
      const petDoc = await petRef.get();

      if (!petDoc.exists) {
        throw new Error("Pet not found in RescuedAnimals.");
      }

      // Extract pet data if needed
      const petData = petDoc.data(); // Get the pet's original data

      // Delete the pet from RescuedAnimals
      await petRef.delete();

      // In AdoptedAnimals, use appPetID as the document ID and save petId as a field inside
      await db
        .collection("AdoptedAnimals")
        .doc(appPetID.toString())
        .set({
          petId: petId, // Save petId as a field in the document
          ...petData, // Include pet details as needed
        });

      // Send a success response
      res.json({
        message:
          "Application approved, pet transferred to AdoptedAnimals with only appPetID and petId, and email sent.",
        appPetID,
      });
    } catch (error) {
      console.error("Error approving application:", error);

      // Handle errors by moving the application back to PENDING if necessary
      if (
        error.message === "Pet ID is missing in the application." ||
        error.message === "Pet not found in RescuedAnimals."
      ) {
        // Ensure the application stays in the PENDING collection
        const applicationData = await appRef.get();
        if (applicationData.exists) {
          applicationData.data().status = "Pending"; // Restore status to Pending
          await appRef.set(applicationData.data()); // Update the status back to Pending
        }
      }

      res.status(500).json({
        message: "Error approving application",
        error: error.message,
      });
    }
  });

  // Helper function to send approval email
  async function sendApprovalEmail(email, applicationData) {
    // Prepare email content
    const mailOptions = {
      from: "barkcodecompawnion@gmail.com",
      to: email,
      subject: "Your Pet Adoption Application Has Been Approved!",
      html: `
        <h1>Congratulations! Your Application Has Been Approved</h1>
        <p>Dear ${applicationData.applicant?.name || "Valued Applicant"},</p>
        <p>We are pleased to inform you that your pet adoption application has been approved!</p>
        <p><strong>Your Application Details:</strong></p>
        <ul>
          <li>Application ID: ${applicationData.applicationAppId}</li>
          <li>Application Pet ID: ${applicationData.appPetID}</li>
        </ul>
        <p>Please keep your Application Pet ID safe as you'll need it for future reference.</p>
        <p>Next Steps:</p>
        <ol>
          <li>Please visit our center during operating hours</li>
          <li>Bring your Application Pet ID: ${applicationData.appPetID}</li>
          <li>Bring a valid government ID</li>
          <li>Complete the final adoption paperwork</li>
        </ol>
        <p>If you have any questions, please don't hesitate to contact us.</p>
        <p>Thank you for choosing to adopt!</p>
      `,
    };

    // Send the email
    await transporter.sendMail(mailOptions);

    // Log the email in the database
    await db.collection("EmailLogs").add({
      applicationId: applicationData.applicationAppId,
      appPetID: applicationData.appPetID,
      recipientEmail: email,
      sentAt: new Date(),
      status: "sent",
      type: "approval_notification",
    });
  }

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
        return res.status(404).json({ message: "Application not found" });
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
      res.json({ message: "Application deleted from reject" });
    } catch (error) {
      console.error("Error deleting rejected application:", error);
      res
        .status(500)
        .json({ message: "Error deleting rejected application", error });
    }
  });

  return application;
};
