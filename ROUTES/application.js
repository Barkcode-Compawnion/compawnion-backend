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
        status: "Pending", // Set status to "Pending"
      };

      // Add the new application document under the "PENDING" document
      const appRef = db
        .collection("Applications") // Collection "Applications"
        .doc("PENDING") // Document "PENDING"
        .collection("Applications") // Sub-collection "Applications" under "PENDING"
        .doc(formattedAppId); // Use formatted AppId as document ID

      await appRef.set(newApplication); // Save the application data

      console.log("Application added with ID:", formattedAppId);
      return res
        .status(201)
        .send({ message: `Application added with ID: ${formattedAppId}` });
    } catch (error) {
      console.error("Error occurred while processing the request:", error);
      return res
        .status(500)
        .json({ message: "Error adding an application", error: error.message });
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
      const email = applicationData.applicant?.email; // Extract email from applicationData

      if (!email) {
        return res.status(400).json({ message: "Applicant email not found" });
      }

      // Get the next AppPetID and set status to "Approved"
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

      // Send the approval email
      await sendApprovalEmail(email, applicationData);

      res.json({
        message: "Application approved and moved to APPROVED status",
        appPetID,
      });
    } catch (error) {
      console.error("Error approving application:", error);
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
