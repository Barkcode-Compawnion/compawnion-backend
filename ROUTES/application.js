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

  // Helper Functions
  async function getNextAppPetId() {
    const appPetID = Math.floor(10000 + Math.random() * 90000);
    return appPetID;
  }

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

  // Function to send email for online approval
  async function sendOnlineApprovalEmail(email, applicationData, schedules) {
    const { roomLink, meetingDate, Time } = schedules;

    const mailOptions = {
      from: "barkcodecompawnion@gmail.com",
      to: email,
      subject:
        "Your Pet Adoption Application Has Been Approved for an Online Meeting!",
      html: `
      <h1>Congratulations! Your Online Application Meeting Has Been Approved</h1>
      <p>Dear ${applicationData.applicant?.name || "Valued Applicant"},</p>
      <p>We are excited to inform you that your online pet adoption application meeting has been approved!</p>
      <p><strong>Meeting Details:</strong></p>
      <ul>
        <li>Room Link: <a href="${roomLink}">${roomLink}</a></li>
        <li>Date: ${Date}</li>
        <li>Time: ${Time}</li>
      </ul>
      <p><strong>Your Application Details:</strong></p>
      <ul>
        <li>Application ID: ${applicationData.applicationAppId}</li>
        <li>Application Pet ID: ${applicationData.appPetID}</li>
      </ul>
      <p>Please join the meeting using the link above at the scheduled time. If you have any questions, feel free to reach out to us.</p>
      <p>Thank you for choosing to adopt!</p>
    `,
    };

    await transporter.sendMail(mailOptions);
    await db.collection("EmailLogs").add({
      applicationId: applicationData.applicationAppId,
      appPetID: applicationData.appPetID,
      recipientEmail: email,
      sentAt: new Date(),
      status: "sent",
      type: "online_approval_notification",
    });
  }

  // Function to send email for onsite approval
  async function sendOnsiteApprovalEmail(email, applicationData, schedules) {
    const { OnsiteMeetingDate } = schedules;

    const mailOptions = {
      from: "barkcodecompawnion@gmail.com",
      to: email,
      subject:
        "Your Pet Adoption Application Has Been Approved for an Onsite Meeting!",
      html: `
      <h1>Congratulations! Your Onsite Application Meeting Has Been Approved</h1>
      <p>Dear ${applicationData.applicant?.name || "Valued Applicant"},</p>
      <p>We are excited to inform you that your onsite pet adoption application meeting has been approved!</p>
      <p><strong>Meeting Details:</strong></p>
      <ul>
        <li>Onsite Meeting Date: ${OnsiteMeetingDate}</li>
      </ul>
      <p><strong>Your Application Details:</strong></p>
      <ul>
        <li>Application ID: ${applicationData.applicationAppId}</li>
        <li>Application Pet ID: ${applicationData.appPetID}</li>
      </ul>

       <p>Next Steps:</p>
        <ol>
          <li>Bring a valid government ID</li>
          <li>Complete the final adoption paperwork</li>
        </ol>
        
      <p>Please make sure to attend the onsite meeting on the specified date. If you have any questions, feel free to reach out to us.</p>
      <p>Thank you for choosing to adopt!</p>
    `,
    };

    await transporter.sendMail(mailOptions);
    await db.collection("EmailLogs").add({
      applicationId: applicationData.applicationAppId,
      appPetID: applicationData.appPetID,
      recipientEmail: email,
      sentAt: new Date(),
      status: "sent",
      type: "onsite_approval_notification",
    });
  }

  async function sendApprovalEmail(email, applicationData) {
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
        <p>If you have any questions, please don't hesitate to contact us.</p>
        <p>Thank you for choosing to adopt!</p>
      `,
    };
    await transporter.sendMail(mailOptions);
    await db.collection("EmailLogs").add({
      applicationId: applicationData.applicationAppId,
      appPetID: applicationData.appPetID,
      recipientEmail: email,
      sentAt: new Date(),
      status: "sent",
      type: "approval_notification",
    });
  }

  // Routes (GET > POST > PUT > DELETE)

  // GET Routes
  application.get("/all", async (req, res) => {
    try {
      const pendingRef = db
        .collection("Applications")
        .doc("PENDING")
        .collection("Applications");
      const pendingSnapshot = await pendingRef.get();
      const pendingApplications = pendingSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const approvedRef = db
        .collection("Applications")
        .doc("APPROVED")
        .collection("Applications");
      const approvedSnapshot = await approvedRef.get();
      const approvedApplications = approvedSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const rejectRef = db
        .collection("Applications")
        .doc("REJECT")
        .collection("Applications");
      const rejectSnapshot = await rejectRef.get();
      const rejectApplications = rejectSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const allApplications = {
        pending: pendingApplications,
        approved: approvedApplications,
        rejected: rejectApplications,
      };
      res.json(allApplications);
    } catch (error) {
      console.error("Error fetching all applications:", error);
      res.status(500).json({
        message: "Error fetching all applications",
        error: error.message,
      });
    }
  });

  application.get("/pending", async (req, res) => {
    try {
      const pendingRef = db
        .collection("Applications")
        .doc("PENDING")
        .collection("Applications");
      const pendingSnapshot = await pendingRef.get();
      const pendingApplications = pendingSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const PENDApplications = {
        pending: pendingApplications,
      };
      res.json(PENDApplications);
    } catch (error) {
      console.error("Error fetching all applications:", error);
      res.status(500).json({
        message: "Error fetching all applications",
        error: error.message,
      });
    }
  });

  application.get("/:id", async (req, res) => {
    const appId = req.params.id;
    try {
      const appRef = db
        .collection("Applications")
        .doc("PENDING")
        .collection("Applications")
        .doc(appId);
      const appDoc = await appRef.get();
      if (!appDoc.exists)
        return res.status(404).json({ message: "Application not found" });

      const applicationData = appDoc.data();
      res.json({ application: { id: appDoc.id, ...applicationData } });
    } catch (error) {
      console.error("Error retrieving application:", error);
      res.status(500).json({ message: "Error retrieving application", error });
    }
  });

  // POST Routes
  application.post("/", async (req, res) => {
    const appData = req.body; // Includes applicant details, petId, and potentially appPetID for subsequent adoption

    try {
      const {
        applicationType,
        agreement,
        paymentAgreement,
        petOwnershipExperience,
        dwelling: {
          planningToMoveOut,
          ownership,
          numberOfPets,
          petsAllowedInHouse,
          numberOfHouseMembers,
          dwellingType,
        },
        veterinaryClinicName,
        applicant: { name, street, lot, email, phone  },
        petId, // Get the petId from the request body
        appPetID, // Existing appPetID for subsequent adoption (optional)
      } = appData;

      if (!petId) {
        return res.status(400).json({ message: "Pet ID is required" });
      }

      // Check if the petId exists in the database (FireStore)
      const petDoc = await db.collection("RescuedAnimals").doc(petId).get();
      if (!petDoc.exists) {
        return res.status(404).json({ message: "Pet not found" });
      }

      // Generate application ID
      const appId = await getNextAppId();
      const formattedAppId = appId.toString().padStart(3, "0");

      const newApplication = {
        applicationType,
        agreement,
        paymentAgreement,
        applicationAppId: formattedAppId,
        petOwnershipExperience,
        dwelling: {
          planningToMoveOut,
          ownership,
          numberOfPets,
          petsAllowedInHouse,
          numberOfHouseMembers,
          dwellingType,
        },
        veterinaryClinicName,
        applicant: { name, street, lot, email, phone  },
        petData: { id: petId }, // Include the petId here
        appPetID: appPetID || null, // Set appPetID to null if not provided
        status: "Pending",
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

  application.post("/:id/onlineApprove", async (req, res) => {
    const appId = req.params.id;
    const { schedules } = req.body; // Expecting { roomLink, meetingDate, Time }
    try {
      // Fetch the application from the "PENDING" collection
      const appRef = db
        .collection("Applications")
        .doc("PENDING")
        .collection("Applications")
        .doc(appId);
      const appDoc = await appRef.get();

      // Check if application exists
      if (!appDoc.exists)
        return res.status(404).json({ message: "Application not found" });

      const applicationData = appDoc.data();
      const email = applicationData.applicant?.email;
      if (!email)
        return res.status(400).json({ message: "Applicant email not found" });

      // Validate schedule details
      const { roomLink, meetingDate, Time } = schedules;
      if (!roomLink || !meetingDate || !Time) {
        return res.status(400).json({
          message:
            "Room link, Date (meetingDate), and Time are required in schedules.",
        });
      }

      // Convert the meetingDate (string) to a Date object
      const meetingDateObj = new Date(meetingDate);
      if (isNaN(meetingDateObj)) {
        return res.status(400).json({ message: "Invalid Date format" });
      }

      // Update application status and add schedule details
      applicationData.status = "Online Approved";
      applicationData.schedules = {
        roomLink,
        meetingDate: meetingDateObj,
        Time,
      };

      // Keep the application in "PENDING"
      await db
        .collection("Applications")
        .doc("PENDING")
        .collection("Applications")
        .doc(appId)
        .set(applicationData);

      // Send online approval email with scheduling details
      await sendOnlineApprovalEmail(email, applicationData, schedules);

      res.json({
        message:
          "Application approved for online meeting, and email sent with schedule details.",
        schedules,
      });
    } catch (error) {
      console.error("Error in online approving application:", error);
      res.status(500).json({
        message: "Error in online approving application",
        error: error.message,
      });
    }
  });

  application.put("/:id/onsiteApprove", async (req, res) => {
    const appId = req.params.id;
    const { schedules } = req.body; // Expecting { OnsiteMeetingDate }
    try {
      // Fetch the application from the "PENDING" collection
      const appRef = db
        .collection("Applications")
        .doc("PENDING")
        .collection("Applications")
        .doc(appId);
      const appDoc = await appRef.get();

      // Check if application exists
      if (!appDoc.exists)
        return res.status(404).json({ message: "Application not found" });

      const applicationData = appDoc.data();
      const email = applicationData.applicant?.email;
      if (!email)
        return res.status(400).json({ message: "Applicant email not found" });

      // Validate schedule details
      const { OnsiteMeetingDate } = schedules;
      if (!OnsiteMeetingDate) {
        return res.status(400).json({
          message: "OnsiteMeetingDate is required in schedules.",
        });
      }

      // Ensure the existing online approval data is retained
      const existingSchedules = applicationData.schedules || {};
      const updatedSchedules = {
        ...existingSchedules,
        OnsiteMeetingDate, // Add the new onsite meeting date
      };

      // Update application status to "Waiting for Final Approval"
      applicationData.status = "Waiting for Final Approval";
      applicationData.schedules = updatedSchedules; // Keep existing schedules and add new data

      // Keep the application in "PENDING"
      await db
        .collection("Applications")
        .doc("PENDING")
        .collection("Applications")
        .doc(appId)
        .set(applicationData);

      // Send onsite approval email with scheduling details
      await sendOnsiteApprovalEmail(email, applicationData, schedules);

      res.json({
        message:
          "Application approved for onsite meeting, and email sent with schedule details.",
        schedules: updatedSchedules,
      });
    } catch (error) {
      console.error("Error in onsite approving application:", error);
      res.status(500).json({
        message: "Error in onsite approving application",
        error: error.message,
      });
    }
  });

  application.post("/:id/approve", async (req, res) => {
    const appId = req.params.id;
    try {
      // Fetch the application from the "PENDING" collection
      const appRef = db
        .collection("Applications")
        .doc("PENDING")
        .collection("Applications")
        .doc(appId);
      const appDoc = await appRef.get();

      if (!appDoc.exists)
        return res.status(404).json({ message: "Application not found" });

      const applicationData = appDoc.data();
      const email = applicationData.applicant?.email;
      if (!email)
        return res.status(400).json({ message: "Applicant email not found" });

      const petId = applicationData.petData?.id;
      if (!petId)
        return res
          .status(400)
          .json({ message: "Pet ID is missing in the application." });

      const appPetID = applicationData.appPetID || (await getNextAppPetId());

      // Check if the application has passed the online and onsite approval
      if (
        applicationData.status !== "Online Approved" &&
        applicationData.status !== "Waiting for Final Approval"
      ) {
        return res.status(400).json({
          message:
            "Application must be approved for an online meeting or onsite meeting first.",
        });
      }

      // Proceed with approval
      applicationData.status = "Approved";
      applicationData.appPetID = appPetID;

      // Move to the "APPROVED" collection
      await db
        .collection("Applications")
        .doc("APPROVED")
        .collection("Applications")
        .doc(appId)
        .set(applicationData);
      await appRef.delete();

      // Send approval email
      await sendApprovalEmail(email, applicationData);

      const petRef = db.collection("RescuedAnimals").doc(petId);
      const petDoc = await petRef.get();
      if (!petDoc.exists) throw new Error("Pet not found in RescuedAnimals.");

      const petData = petDoc.data();
      await petRef.delete();

      // Add pet to the AdoptedAnimals collection
      const adoptedAnimalRef = db
        .collection("AdoptedAnimals")
        .doc(appPetID.toString());
      await adoptedAnimalRef.set(
        { [petId]: { id: petId, ...petData } },
        { merge: true }
      );

      res.json({
        message:
          "Application approved, pet added to AdoptedAnimals under the user’s appPetID, and email sent.",
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

  // PUT Routes
  application.put("/:id/reject", async (req, res) => {
    const appId = req.params.id;
    try {
      const appRef = db
        .collection("Applications")
        .doc("PENDING")
        .collection("Applications")
        .doc(appId);
      const appDoc = await appRef.get();
      if (!appDoc.exists)
        return res.status(404).json({ message: "Application not found" });

      const applicationData = appDoc.data();
      applicationData.status = "Rejected";

      await db
        .collection("Applications")
        .doc("REJECT")
        .collection("Applications")
        .doc(appId)
        .set(applicationData);
      await appRef.delete();

      res.json({ message: "Application rejected and moved to REJECT status" });
    } catch (error) {
      console.error("Error rejecting application:", error);
      res
        .status(500)
        .json({ message: "Error rejecting application", error: error.message });
    }
  });

  // DELETE Routes
  application.delete("/reject/:id", async (req, res) => {
    const appId = req.params.id;
    try {
      const rejectRef = db
        .collection("Applications")
        .doc("REJECT")
        .collection("Applications")
        .doc(appId);
      const rejectDoc = await rejectRef.get();
      if (!rejectDoc.exists)
        return res
          .status(404)
          .json({ message: "Application not found in rejected applications" });

      await rejectRef.delete();
      res.json({ message: "Rejected application deleted successfully" });
    } catch (error) {
      console.error("Error deleting rejected application:", error);
      res.status(500).json({
        message: "Error deleting rejected application",
        error: error.message,
      });
    }
  });

  return application;
};
