const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const Compawnions = express.Router();

const secretKey = "sikretolangto"; // Replace with your secret key

// Configure nodemailer transporter with direct settings
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "barkcodecompawnion@gmail.com", // Replace with actual email
    pass: "fmji xuvs akpb mrke", // Replace with actual app password
  },
});

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {import('@google-cloud/storage').Bucket} storage
 * @returns {express.Router}
 */
module.exports = function (db, storage) {
  async function getNextCompId() {
    const counterRef = db.collection("Counter").doc("CompIDCounter");

    try {
      const newCompId = await db.runTransaction(async (transaction) => {
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

      return newCompId;
    } catch (error) {
      console.error("Error generating new Companion ID:", error);
      throw new Error("Failed to generate new Companion ID.");
    }
  }

  // Function to send registration email to the Compawnion user
  async function sendCompawnionRegistrationEmail(
    email,
    username,
    name,
    password
  ) {
    const mailOptions = {
      from: "barkcodecompawnion@gmail.com", // Replace with actual email
      to: email,
      subject: "Compawnion Registration Successful",
      html: `
        <h1>Welcome to Compawnion!</h1>
        <p>Dear ${name},</p>
        <p>Your account has been successfully registered. Here are your details:</p>
        <ul>
          <li><strong>Name:</strong> ${name}</li>
          <li><strong>Username:</strong> ${username}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Initial Password:</strong> ${password}</li>
        </ul>
        <p>Please keep your password safe.</p>
        <p>We look forward to working with you!</p>
      `,
    };

    await transporter.sendMail(mailOptions);
  }
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Register Companion (Basic Information)
  Compawnions.post("/register", async (req, res) => {
    console.log(req.body); // Log the request payload to check the data
    const {
      accountCreate: { Name, Username, Email, Password },
      appPetID, // New parameter added to receive the appPetID
    } = req.body;

    if (!appPetID) {
      return res.status(400).json({ message: "appPetID is required." });
    }

    try {
      // Check if the appPetID exists in the AdoptedAnimals collection
      const adoptedAnimalRef = db.collection("AdoptedAnimals").doc(appPetID);
      const adoptedAnimalDoc = await adoptedAnimalRef.get();

      if (!adoptedAnimalDoc.exists) {
        return res
          .status(404)
          .json({ message: "Invalid appPetID. Adoption not found." });
      }

      // Check if the username already exists
      const existingUserSnapshot = await db
        .collection("Compawnions")
        .where("CompawnionUser.accountCreate.Username", "==", Username)
        .get();

      if (!existingUserSnapshot.empty) {
        return res.status(400).json({ message: "Username already exists." });
      }

      // Send registration email with the plain password before hashing
      await sendCompawnionRegistrationEmail(Email, Username, Name, Password);

      // Hash the password before storing it
      const hashedPassword = await bcrypt.hash(Password, 10);

      // Call to get the next Companion ID
      const compId = await getNextCompId();
      const formattedCompId = compId.toString().padStart(3, "0");

      // Add the new Companion document
      await db
        .collection("Compawnions")
        .doc(formattedCompId)
        .set({
          CompawnionUser: {
            accountCreate: { Username, Email, Password: hashedPassword },
            MedSched: [],
            TrustedVet: [],
            CompawnionSched: [],
            appPetID, // Store the appPetID as part of the Companion document
          },
          Status: "Inactive", // Set initial status to Inactive
          LastLogin: null,
          LastLogout: null,
        });

      res.status(201).json({
        message: `Companion registered successfully with ID: ${formattedCompId}`,
      });
    } catch (error) {
      console.error("Error registering companion:", error); // Log the error
      res.status(500).json({
        message: "Failed to register companion.",
        error: error.message,
      });
    }
  });

  // New route to add details to CompawnionUser
  Compawnions.post("/addDetails", async (req, res) => {
    const { Username, MedSched, TrustedVet, CompawnionSched } = req.body;

    // before ka ma-confuse ka eto yung mga attributes sa loob ng mga to:
    // ayan kasi yung mga ica-call mo sa mga textbox etc.

    //MedSched: { SchedTitle, SchedDate, SchedTime, SchedVetClinic, SchedPet },
    //TrustedVet: { TVVetClinic, TVAddress },
    //CompawnionSched: { EventTitle, CSDate, CSTime, GmeetRoom },

    if (!Username) {
      return res.status(400).json({ message: "Username is required." });
    }

    try {
      // Locate companion document by Username
      const userSnapshot = await db
        .collection("Compawnions")
        .where("CompawnionUser.accountCreate.Username", "==", Username)
        .get();

      if (userSnapshot.empty) {
        return res.status(404).json({ message: "Companion not found." });
      }

      const userRef = userSnapshot.docs[0].ref;
      const userData = userSnapshot.docs[0].data().CompawnionUser;

      // Initialize arrays if they do not exist
      const medSchedArray = userData.MedSched || [];
      const trustedVetArray = userData.TrustedVet || [];
      const compawnionSchedArray = userData.CompawnionSched || [];

      // Update MedSched if provided
      if (MedSched) {
        await userRef.update({
          "CompawnionUser.MedSched": medSchedArray.concat(MedSched),
        });
      }

      // Update TrustedVet if provided
      if (TrustedVet) {
        await userRef.update({
          "CompawnionUser.TrustedVet": trustedVetArray.concat(TrustedVet),
        });
      }

      // Update CompawnionSched if provided
      if (CompawnionSched) {
        await userRef.update({
          "CompawnionUser.CompawnionSched":
            compawnionSchedArray.concat(CompawnionSched),
        });
      }

      res.json({ message: "Companion details added successfully." });
    } catch (error) {
      console.error("Error adding companion details:", error); // Log the error
      res.status(500).json({
        message: "Failed to add companion details.",
        error: error.message,
      }); // Include error message in response
    }
  });

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // Login Companion
  // Login Companion
  // Login Companion with Remember Me option
  Compawnions.post("/login", async (req, res) => {
    const { Username, Password, rememberMe } = req.body;

    try {
      // Retrieve the user based on the provided username
      const userSnapshot = await db
        .collection("Compawnions")
        .where("CompawnionUser.accountCreate.Username", "==", Username)
        .get();

      // Check if the user exists
      if (userSnapshot.empty) {
        return res.status(404).json({ message: "User not found." });
      }

      // Get the user data
      const userData = userSnapshot.docs[0].data();

      // Compare the provided password with the hashed password stored in Firestore
      const isMatch = await bcrypt.compare(
        Password,
        userData.CompawnionUser.accountCreate.Password
      ); // Ensure correct path

      if (!isMatch) {
        return res.status(401).json({ message: "Invalid credentials." });
      }

      // Fetch the appPetID associated with the companion
      const appPetID = userData.CompawnionUser.appPetID;

      if (!appPetID) {
        return res
          .status(400)
          .json({ message: "No associated pet found for this companion." });
      }

      // Check if the appPetID exists in the AdoptedAnimals collection
      const adoptedAnimalRef = db.collection("AdoptedAnimals").doc(appPetID);
      const adoptedAnimalDoc = await adoptedAnimalRef.get();

      if (!adoptedAnimalDoc.exists) {
        return res.status(404).json({
          message: "No adopted animal found with the provided appPetID.",
        });
      }

      // Retrieve the adopted animal data (optional, can return in response if needed)
      const adoptedAnimalData = adoptedAnimalDoc.data();

      // Update the user's status and last login timestamp
      const loginTimestamp = new Date().toISOString();
      await userSnapshot.docs[0].ref.update({
        Status: "Active",
        LastLogin: loginTimestamp,
      });

      // Set the token expiration based on the "rememberMe" flag
      const expiresIn = rememberMe ? "7d" : "1h"; // 7 days for rememberMe, 1 hour for normal login

      // Generate token
      const token = jwt.sign({ Username }, secretKey, { expiresIn });

      res.json({
        token,
        adoptedPet: adoptedAnimalData, // Include adopted pet data in the response (optional)
      });
    } catch (error) {
      console.error("Error logging in:", error);
      res.status(500).json({ message: "Failed to log in." });
    }
  });

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // Logout Companion
  Compawnions.post("/logout", async (req, res) => {
    const { Username } = req.body;

    if (!Username) {
      return res.status(400).json({ message: "Username is required." });
    }

    try {
      // Retrieve the user based on the Username
      const userSnapshot = await db
        .collection("Compawnions")
        .where("CompawnionUser.accountCreate.Username", "==", Username)
        .get();

      if (userSnapshot.empty) {
        return res.status(404).json({ message: "User not found." });
      }

      // Set the LastLogout timestamp
      await userSnapshot.docs[0].ref.update({
        LastLogout: new Date().toISOString(), // Record the time of logout
      });

      res.json({ message: "Logout successful." });
    } catch (error) {
      console.error("Error logging out:", error);
      res.status(500).json({ message: "Failed to log out." });
    }
  });
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // Read All Companions
  Compawnions.get("/", async (req, res) => {
    try {
      const snapshot = await db.collection("Compawnions").get();
      const companions = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      res.json({
        message: "Companions retrieved successfully.",
        data: companions,
      });
    } catch (error) {
      res.status(500).json({ message: "Error retrieving Companions." });
    }
  });

  // Read a specific Companion by ID
  Compawnions.get("/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const userRef = db.collection("Compawnions").doc(userId);
      const doc = await userRef.get();

      if (!doc.exists) {
        return res.status(404).json({ message: "Companion not found." });
      }
      res.json({
        message: "Companion retrieved successfully.",
        data: { id: doc.id, ...doc.data() },
      });
    } catch (error) {
      res.status(500).json({ message: "Error retrieving Companion." });
    }
  });

  // Get the adopted animal owned by the Companion using their appPetID
  Compawnions.get("/myPets/:companionId", async (req, res) => {
    const { companionId } = req.params; // Get companionId from the URL params

    try {
      // Retrieve Companion document by companionId
      const companionRef = db.collection("Compawnions").doc(companionId);
      const companionDoc = await companionRef.get();

      if (!companionDoc.exists) {
        return res.status(404).json({ message: "Companion not found." });
      }

      // Get the appPetID from the Companion document
      const appPetID = companionDoc.data().CompawnionUser.appPetID;

      if (!appPetID) {
        return res.status(404).json({
          message: "No adopted animal associated with this companion.",
        });
      }

      // Now, make a request to the adoptedAnimals route to get the adopted animal
      // Using the already existing method in adoptedAnimals.js to fetch the adopted animal by appPetID
      const adoptedAnimalRef = db.collection("AdoptedAnimals").doc(appPetID);
      const adoptedAnimalDoc = await adoptedAnimalRef.get();

      if (!adoptedAnimalDoc.exists) {
        return res.status(404).json({ message: "Adopted animal not found." });
      }

      // Return the adopted animal data
      res.json({
        message: "Adopted animal retrieved successfully.",
        data: adoptedAnimalDoc.data(),
      });
    } catch (error) {
      console.error("Error retrieving adopted animal:", error);
      res.status(500).json({ message: "Error retrieving adopted animal." });
    }
  });

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // Update Companion
  Compawnions.put("/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const userRef = db.collection("Compawnions").doc(userId);
      const updatedUser = req.body;
      await userRef.update(updatedUser);
      res.json({ message: "Companion updated successfully." });
    } catch (error) {
      res.status(500).json({ message: "Error updating Companion." });
    }
  });
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // Delete Companion
  Compawnions.delete("/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      const userRef = db.collection("Compawnions").doc(userId);
      await userRef.delete();
      res.json({ message: "Companion deleted successfully." });
    } catch (error) {
      res.status(500).json({ message: "Error deleting Companion." });
    }
  });

  return Compawnions;
};
