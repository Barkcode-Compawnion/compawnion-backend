const express = require("express");
const nodemailer = require("nodemailer");
const application = express.Router();

module.exports = function (db) {
  // Configure nodemailer transporter with direct settings
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "barkcodecompawnion@gmail.com", // Replace with actual email
      pass: "fmji xuvs akpb mrke",
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

  // Emailer function
  async function sendApplicationEmail(email, applicationData) {
    const mailOptions = {
      from: "barkcodecompawnion@gmail.com",
      to: email,
      subject: "Your Application Form Has Been Submitted!",
      html: `
      <h1>Congratulations! Your Application Form Has Been Submitted</h1>
      <p>Dear ${
        applicationData.applicant?.name?.firstName || "Valued Applicant"
      } ${applicationData.applicant?.name?.middleName || ""} ${
        applicationData.applicant?.name?.lastName || ""
      },</p>
      <p>We are excited to inform you that your application has been successfully submitted.</p>
      <p><strong>Your Application Details:</strong></p>
      <ul>
        <li>Terms and Conditions: ${
          applicationData.termsAndCondission ? "Yes" : "No"
        }</li>
        <li>Payment Agreement: ${
          applicationData.paymentAgreement ? "Yes" : "No"
        }</li>
        <li>Application Type: ${applicationData.applicationType}</li>
        <li>Application ID: ${applicationData.applicationAppId}</li>
        <li>Application Pet ID: ${
          applicationData.appPetID || "Not Assigned Yet"
        }</li>
        <li>Pet ID: ${applicationData.petId}</li>
      </ul>
      <p><strong>Applicant Details:</strong></p>
      <ul>
        <li>Name: ${applicationData.applicant?.name?.firstName} ${
        applicationData.applicant?.name?.middleName || ""
      } ${applicationData.applicant?.name?.lastName}</li>
        <li>Birthdate: ${applicationData.applicant?.birthdate}</li>
        <li>Occupation: ${applicationData.applicant?.occupation}</li>
        <li>Address: ${applicationData.applicant?.address?.lot || ""} ${
        applicationData.applicant?.address?.street || ""
      }, ${applicationData.applicant?.address?.baranggay || ""}, ${
        applicationData.applicant?.address?.cityOrMunicipality || ""
      }, ${applicationData.applicant?.address?.province || ""}, ${
        applicationData.applicant?.address?.country || ""
      }</li>
        <li>Contact Email: ${applicationData.applicant?.contact?.email}</li>
        <li>Phone Number: ${
          applicationData.applicant?.contact?.phoneNumber
        }</li>
        <li>Facebook: ${applicationData.applicant?.contact?.facebook || ""}</li>
      </ul>
      <p><strong>Dwelling Information:</strong></p>
      <ul>
        <li>Type: ${applicationData.dwelling?.type}</li>
        <li>Ownership: ${applicationData.dwelling?.ownership}</li>
        <li>Number of House Members: ${
          applicationData.dwelling?.numberOfHouseMembers
        }</li>
        <li>Number of Pets: ${applicationData.dwelling?.numberOfPets}</li>
        <li>Pets Allowed in House: ${
          applicationData.dwelling?.petsAllowedInHouse ? "Yes" : "No"
        }</li>
        <li>Planning to Move Out: ${
          applicationData.dwelling?.planningToMoveOut ? "Yes" : "No"
        }</li>
      </ul>
      <p><strong>Pet Care Information:</strong></p>
      <ul>
        <li>Pet Ownership Experience: ${
          applicationData.petCare?.petOwnershipExperience || "N/A"
        }</li>
        <li>Veterinarian: ${applicationData.petCare?.veterinarian || "N/A"}</li>
      </ul>
      <p>Status: ${applicationData.status}</p>
      <p>Our team will review your application and contact you shortly. If you have any questions, feel free to reach out to us.</p>
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
      type: "application_notification",
    });
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
      <p>Dear ${
        applicationData.applicant?.name?.firstName || "Valued Applicant"
      } ${applicationData.applicant?.name?.middleName || "Valued Applicant"} ${
        applicationData.applicant?.name?.lastName || "Valued Applicant"
      },</p>
      <p>We are excited to inform you that your online pet adoption application meeting has been approved!</p>
      <p><strong>Meeting Details:</strong></p>
      <ul>
        <li>Room Link: <a href="${applicationData.schedules?.roomLink}">${
        applicationData.schedules?.roomLink
      }</a></li>
        <li>Date: ${applicationData.schedules?.meetingDate}</li>
        <li>Time: ${applicationData.schedules?.Time}</li>
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
      <p>Dear ${
        applicationData.applicant?.name?.firstName || "Valued Applicant"
      } ${applicationData.applicant?.name?.middleName || "Valued Applicant"} ${
        applicationData.applicant?.name?.lastName || "Valued Applicant"
      },</p>
      <p>We are excited to inform you that your onsite pet adoption application meeting has been approved!</p>
      <p><strong>Meeting Details:</strong></p>
      <ul>
        <li>Onsite Meeting Date: ${
          applicationData.schedules?.OnsiteMeetingDate
        }</li>
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
      <p>Dear ${
        applicationData.applicant?.name?.firstName || "Valued Applicant"
      } ${applicationData.applicant?.name?.middleName || "Valued Applicant"} ${
        applicationData.applicant?.name?.lastName || "Valued Applicant"
      },</p>
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

  async function sendRejectionEmail(email, applicationData) {
    const mailOptions = {
      from: "barkcodecompawnion@gmail.com",
      to: email,
      subject: "Your Pet Adoption Application Has Been Rejected",
      html: `
            <h1>We're Sorry to Inform You</h1>
            <p>Dear ${
              applicationData.applicant?.name?.firstName || "Valued Applicant"
            } ${applicationData.applicant?.name?.middleName || ""} ${
        applicationData.applicant?.name?.lastName || ""
      },</p>
            <p>We regret to inform you that your pet adoption application has been rejected. We understand this may be disappointing news.</p>
            <p><strong>Application Details:</strong></p>
            <ul>
                <li>Application ID: ${applicationData.applicationAppId}</li>
                <li>Pet ID: ${applicationData.petId}</li>
                <li>Application Pet ID: ${applicationData.appPetID}</li>
            </ul>
            <p>If you have any questions or would like further clarification, please feel free to reach out to us.</p>
            <p>Thank you for your interest in adopting and for supporting animal welfare.</p>
        `,
    };

    // Send the email
    await transporter.sendMail(mailOptions);

    // Log the email sending event
    await db.collection("EmailLogs").add({
      applicationId: applicationData.applicationAppId,
      appPetID: applicationData.appPetID,
      recipientEmail: email,
      sentAt: new Date(),
      status: "sent",
      type: "rejection_notification",
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
      // Check in PENDING applications
      let appRef = db
        .collection("Applications")
        .doc("PENDING")
        .collection("Applications")
        .doc(appId);
      let appDoc = await appRef.get();

      // If not found in PENDING, check in REJECTED applications
      if (!appDoc.exists) {
        appRef = db
          .collection("Applications")
          .doc("REJECT")
          .collection("Applications")
          .doc(appId);
        appDoc = await appRef.get();
      }

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
        termsAndCondission,
        paymentAgreement,
        applicationType,
        appPetID, // Existing appPetID for subsequent adoption (optional)
        petId, // Get the petId from the request body
        applicant: {
          name: { firstName, middleName, lastName },
          birthdate,
          occupation,
          address: {
            country,
            province,
            cityOrMunicipality,
            baranggay,
            street,
            lot,
          },
          contact: { email, phoneNumber, facebook },
        },
        dwelling: {
          type,
          ownership,
          numberOfHouseMembers,
          numberOfPets,
          petsAllowedInHouse,
          planningToMoveOut,
        },
        petCare: { petOwnershipExperience, veterinarian },
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

      // Format the date
      const dateFormatter = new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Manila",
      });
      const formattedDate = dateFormatter.format(new Date());

      const newApplication = {
        termsAndCondission,
        paymentAgreement,
        applicationType,
        applicationAppId: formattedAppId,
        appPetID: appPetID || null, // Set appPetID to null if not provided
        petId,
        applicant: {
          name: {
            firstName,
            middleName,
            lastName,
          },
          birthdate,
          occupation,
          address: {
            country,
            province,
            cityOrMunicipality,
            baranggay,
            street,
            lot,
          },
          contact: {
            email,
            phoneNumber,
            facebook,
          },
        },
        dwelling: {
          type,
          ownership,
          numberOfHouseMembers,
          numberOfPets,
          petsAllowedInHouse,
          planningToMoveOut,
        },
        petCare: {
          petOwnershipExperience,
          veterinarian,
        },
        status: "Pending",
        dateOfSubmission: formattedDate, // Add formatted date of submission
      };

      // Add the new application under "PENDING"
      const appRef = db
        .collection("Applications")
        .doc("PENDING")
        .collection("Applications")
        .doc(formattedAppId);

      // Replace the previous sendApplicationEmail line with this one
      await sendApplicationEmail(email, newApplication);

      await appRef.set(newApplication);
      console.log("Application added with ID:", formattedAppId);

      // Transfer pet data to PENDINGPETS and delete from RescuedAnimals
      const petData = petDoc.data();
      const pendingPetsRef = db.collection("PENDINGPETS").doc(petId);

      // Copy the data from the existing pet document to the PENDINGPETS collection
      await pendingPetsRef.set({
        ...petData,
        status: "Pending Adoption",
        appPetID: appPetID || null, // Ensure appPetID is included (null if not provided)
      });

      // Delete the pet document from RescuedAnimals after transfer
      await db.collection("RescuedAnimals").doc(petId).delete();

      console.log(
        `Pet ${petId} transferred to PENDINGPETS collection and deleted from RescuedAnimals.`
      );

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
      const email = applicationData.applicant?.contact?.email;
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
      const email = applicationData.applicant?.contact?.email;
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
    const appId = req.params.id; // Get application ID from the route parameters
    try {
      // Fetch the application from the "PENDING" collection
      const appRef = db
        .collection("Applications")
        .doc("PENDING")
        .collection("Applications")
        .doc(appId);

      const appDoc = await appRef.get();

      if (!appDoc.exists) {
        return res.status(404).json({ message: "Application not found" });
      }

      const applicationData = appDoc.data(); // Get application data
      const email = applicationData.applicant?.contact?.email; // Get applicant's email

      if (!email) {
        return res.status(400).json({ message: "Applicant email not found" });
      }

      const petId = applicationData.petId; // Get the petId from application data
      if (!petId) {
        return res
          .status(400)
          .json({ message: "Pet ID is missing in the application." });
      }

      const appPetID = applicationData.appPetID || (await getNextAppPetId()); // Generate appPetID if not provided

      // Check if the application is already in a valid status for approval
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
      applicationData.status = "Approved"; // Set application status to "Approved"
      applicationData.appPetID = appPetID; // Assign appPetID

      // Move the application to the "APPROVED" collection
      await db
        .collection("Applications")
        .doc("APPROVED")
        .collection("Applications")
        .doc(appId)
        .set(applicationData);
      await appRef.delete(); // Remove application from "PENDING" collection

      // Send approval email
      await sendApprovalEmail(email, applicationData);

      // Fetch pet data from "RescuedAnimals" collection
      const petRef = db.collection("PENDINGPETS").doc(petId);
      const petDoc = await petRef.get();

      if (!petDoc.exists) {
        throw new Error("Pet not found in RescuedAnimals.");
      }

      const petData = petDoc.data(); // Get pet data

      // Remove pet from "RescuedAnimals" collection
      await petRef.delete();

      // Add pet to the "AdoptedAnimals" collection under appPetID
      const adoptedAnimalRef = db
        .collection("AdoptedAnimals")
        .doc(appPetID.toString());
      await adoptedAnimalRef.set(
        { [petId]: { id: petId, ...petData } },
        { merge: true }
      );

      // Respond with success message
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

  // transfer all pets back to Rescued Animal
  application.post("/:appPetID/transferback", async (req, res) => {
    const appPetID = req.params.appPetID; // Get appPetID from route parameter

    try {
      // Reference to the specific adopted pet in AdoptedAnimals
      const adoptedAnimalRef = db.collection("AdoptedAnimals").doc(appPetID);
      const adoptedAnimalDoc = await adoptedAnimalRef.get();

      if (!adoptedAnimalDoc.exists) {
        return res.status(404).json({ message: "Adopted pet not found" });
      }

      const adoptedAnimalData = adoptedAnimalDoc.data();

      // Loop over pets within this adopted animal document
      for (const [petId, petData] of Object.entries(adoptedAnimalData)) {
        // Transfer each pet back to the RescuedAnimals collection
        const rescuedAnimalRef = db.collection("RescuedAnimals").doc(petId);
        await rescuedAnimalRef.set(petData, { merge: true });
      }

      // Delete the adopted animal record from AdoptedAnimals
      await adoptedAnimalRef.delete();

      res.json({
        message:
          "Pet(s) successfully transferred back to RescuedAnimals and removed from AdoptedAnimals.",
      });
    } catch (error) {
      console.error("Error transferring pet back to RescuedAnimals:", error);
      res.status(500).json({
        message: "Error transferring pet back to RescuedAnimals",
        error: error.message,
      });
    }
  });

  // transfer specific pet back to Rescued Animal
  application.post("/:appPetID/transferback/:petId", async (req, res) => {
    const { appPetID, petId } = req.params;

    try {
      // Reference to the specific adopted pet document
      const adoptedAnimalRef = db.collection("AdoptedAnimals").doc(appPetID);
      const adoptedAnimalDoc = await adoptedAnimalRef.get();

      if (!adoptedAnimalDoc.exists) {
        return res.status(404).json({ message: "Adopted pet not found" });
      }

      const adoptedAnimalData = adoptedAnimalDoc.data();

      // Check if the specific petId exists in the adopted animal data
      if (!adoptedAnimalData[petId]) {
        return res.status(404).json({
          message: `Pet with ID ${petId} not found in AdoptedAnimals`,
        });
      }

      const petData = adoptedAnimalData[petId];

      // Transfer the pet back to the RescuedAnimals collection
      const rescuedAnimalRef = db.collection("RescuedAnimals").doc(petId);
      await rescuedAnimalRef.set(petData, { merge: true });

      // Remove the pet from the AdoptedAnimals document
      delete adoptedAnimalData[petId];

      // Update the AdoptedAnimals document
      if (Object.keys(adoptedAnimalData).length === 0) {
        // If no pets remain, delete the entire document
        await adoptedAnimalRef.delete();
      } else {
        // Otherwise, update the document with the remaining pets
        await adoptedAnimalRef.set(adoptedAnimalData);
      }

      res.json({
        message: `Pet with ID ${petId} successfully transferred back to RescuedAnimals.`,
      });
    } catch (error) {
      console.error("Error transferring pet back to RescuedAnimals:", error);
      res.status(500).json({
        message: "Error transferring pet back to RescuedAnimals",
        error: error.message,
      });
    }
  });

  // PUT Routes
  application.put("/:appId/reject", async (req, res) => {
    const appId = req.params.appId;
    try {
      // Fetch the application document from the PENDING collection
      const appRef = db
        .collection("Applications")
        .doc("PENDING")
        .collection("Applications")
        .doc(appId);
      const appDoc = await appRef.get();

      if (!appDoc.exists) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Retrieve application data
      const applicationData = appDoc.data();
      const email = applicationData.applicant?.contact?.email; // Extract email from applicationData

      if (!email) {
        return res
          .status(400)
          .json({ message: "Applicant email not found in application data." });
      }

      // Check if the associated pet exists in PENDINGPETS
      const petId = applicationData.petId;
      const pendingPetRef = db.collection("PENDINGPETS").doc(petId);
      const pendingPetDoc = await pendingPetRef.get();

      if (!pendingPetDoc.exists) {
        return res
          .status(404)
          .json({ message: "Associated pet not found in PENDINGPETS" });
      }

      // Transfer the pet back to RescuedAnimals
      const petData = pendingPetDoc.data();
      const rescuedAnimalsRef = db.collection("RescuedAnimals").doc(petId);

      await rescuedAnimalsRef.set({
        ...petData,
        status: "Available",
      });

      // Delete the pet from PENDINGPETS
      await pendingPetRef.delete();

      // Update the application status to REJECTED
      applicationData.status = "Rejected";
      const rejectRef = db
        .collection("Applications")
        .doc("REJECT")
        .collection("Applications")
        .doc(appId);

      await rejectRef.set(applicationData);

      // Delete the application from PENDING
      await appRef.delete();

      // Send rejection email
      await sendRejectionEmail(email, applicationData);

      console.log(
        `Application ${appId} rejected, pet ${petId} transferred back to RescuedAnimals.`
      );

      res.json({
        message: `Application ${appId} rejected and pet ${petId} transferred back to RescuedAnimals.`,
      });
    } catch (error) {
      console.error("Error rejecting application:", error);
      res.status(500).json({
        message: "Error rejecting application",
        error: error.message,
      });
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
