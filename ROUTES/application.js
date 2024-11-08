const express = require("express");
const nodemailer = require("nodemailer");
const application = express.Router();

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
  service: "gmail", // Replace with your email service provider
  auth: {
    user: "barkcodecompawnion@gmail.com", // Your email address
    pass: "hoyacclaayusayusinmolanghellopomagkanoulam69", // Your email password or an App Password if using Gmail
  },
});

// Function to send approval email with appPetID
const sendApprovalEmail = async (email, appPetId) => {
  try {
    const info = await transporter.sendMail({
      from: '"Pet Adoption" <your-email@gmail.com>', // Sender address
      to: email, // Recipient address
      subject: "Application Approved", // Subject line
      text: `Congratulations! Your application has been approved. Your unique Pet ID is: ${appPetId}`, // Plain text body
      html: `<p>Congratulations! Your application has been approved. Your unique Pet ID is: <strong>${appPetId}</strong></p>`, // HTML body
    });

    console.log("Approval email sent: %s", info.messageId);
  } catch (error) {
    console.error("Error sending approval email:", error);
  }
};

// Function to get the next incremented appPetID
async function getNextAppPetId(db) {
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

  router.post("/application/approve", async (req, res) => {
    const { applicationId, email } = req.body; // email for the adopter

    try {
      // Find the application in Firestore
      const applicationRef = db.collection("applications").doc(applicationId);
      const applicationDoc = await applicationRef.get();

      if (!applicationDoc.exists) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Generate a random 5-digit appPetID
      const appPetID = Math.floor(10000 + Math.random() * 90000);

      // Update application status and add appPetID
      await applicationRef.update({
        status: "Approved",
        appPetID: appPetID,
      });

      // Prepare email content
      const mailOptions = {
        from: '"Pet Adoption" <your_email@gmail.com>', // Sender address
        to: email, // Receiver email
        subject: "Your Application has been Approved!",
        text: `Congratulations! Your application has been approved. Your unique Pet ID is: ${appPetID}.`,
        html: `<p>Congratulations! Your application has been approved. Your unique Pet ID is: <strong>${appPetID}</strong>.</p>`,
      };

      // Send email
      await transporter.sendMail(mailOptions);

      console.log(`Approval email sent to ${email} with appPetID: ${appPetID}`);
      res.json({ message: "Application approved and email sent.", appPetID });
    } catch (error) {
      console.error("Error approving application or sending email:", error);
      res
        .status(500)
        .json({
          message: "Error approving application or sending email.",
          error: error.message,
        });
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
