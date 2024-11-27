const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const cookieParser = require("cookie-parser");
const Compawnions = express.Router();

const secretKey = "sikretolangto"; // Replace with your environment variable

// Configure nodemailer transporter securely
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "barkcodecompawnion@gmail.com", // Replace with your email
    pass: "fmji xuvs akpb mrke", // Replace with your app password
  },
});

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {import('@google-cloud/storage').Bucket} storage
 * @returns {express.Router}
 */
module.exports = function (db, storage) {
  /**
   * Helper: Generate the next Companion ID.
   */
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

  /**
   * Helper: Send registration email to Compawnion.
   */
  async function sendCompawnionRegistrationEmail(
    email,
    username,
    name,
    password
  ) {
    const mailOptions = {
      from: "barkcodecompawnion@gmail.com", // Replace with your email
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

  // ////////////////////////////////////////////////////////////////////////
  // Routes Start Here
  // ////////////////////////////////////////////////////////////////////////

  /**
   * POST: Register a new Companion.
   */
  Compawnions.post("/register", async (req, res) => {
    const {
      accountCreate: { Name, Username, Email, Password },
      appPetID, // New parameter to associate adopted pet
    } = req.body;

    if (!appPetID) {
      return res.status(400).json({ message: "appPetID is required." });
    }

    try {
      // Check if the appPetID exists in AdoptedAnimals collection
      const adoptedAnimalRef = db.collection("AdoptedAnimals").doc(appPetID);
      const adoptedAnimalDoc = await adoptedAnimalRef.get();

      if (!adoptedAnimalDoc.exists) {
        return res
          .status(404)
          .json({ message: "Invalid appPetID. Adoption not found." });
      }

      // Check for duplicate username
      const existingUserSnapshot = await db
        .collection("Compawnions")
        .where("CompawnionUser.accountCreate.Username", "==", Username)
        .get();

      if (!existingUserSnapshot.empty) {
        return res.status(400).json({ message: "Username already exists." });
      }

      // Send the email with unencrypted password before hashing it
      await sendCompawnionRegistrationEmail(Email, Username, Name, Password);

      // Hash the password
      const hashedPassword = await bcrypt.hash(Password, 10);

      // Generate Companion ID
      const compId = await getNextCompId();
      const formattedCompId = compId.toString().padStart(3, "0");

      // Create a new Companion document
      await db
        .collection("Compawnions")
        .doc(formattedCompId)
        .set({
          CompawnionUser: {
            accountCreate: { Username, Email, Password: hashedPassword },
            MedSched: [],
            TrustedVet: [],
            CompawnionSched: [],
            appPetID, // Link to adopted pet
          },
          Status: "Inactive", // Default status
          LastLogin: null,
          LastLogout: null,
        });

      res.status(201).json({
        message: `Companion registered successfully with ID: ${formattedCompId}`,
      });
    } catch (error) {
      console.error("Error registering companion:", error);
      res.status(500).json({
        message: "Failed to register companion.",
        error: error.message,
      });
    }
  });

  /**
   * POST: Login Companion with Remember Me.
   */
  // Login Companion with Remember Me option
  // Login route
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

      // Set JWT cookie with token
      res.cookie("token", token, {
        httpOnly: true, // Prevent access to the cookie via JavaScript
        secure: false, // Set to true for production (HTTPS)
        maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000, // Expiration time (7 days or 1 hour)
      });

      res.json({
        message: "Login successful",
        token,
        appPetID,
        companionId: userSnapshot.docs[0].id,
      });
    } catch (error) {
      console.error("Error logging in:", error);
      res.status(500).json({ message: "Failed to log in." });
    }
  });

  /**
   * POST: Logout Companion.
   */
  // Logout route
  Compawnions.post("/logout", (req, res) => {
    // Clear the JWT token cookie
    res.clearCookie("token");

    res.json({ message: "Logout successful." });
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

  Compawnions.post("/addMedSched/:id", async (req, res) => {
    const { id } = req.params;
    const { MedSched } = req.body;

    if (!MedSched) {
      return res.status(400).json({
        message: "All MedSched fields are required.",
      });
    }

    const { SchedTitle, SchedDate, SchedTime, SchedVetClinic, SchedPet } =
      MedSched;
    if (
      !SchedTitle ||
      !SchedDate ||
      !SchedTime ||
      !SchedVetClinic ||
      !SchedPet
    ) {
      return res.status(400).json({
        message:
          "MedSched must include SchedTitle, SchedDate, SchedTime, SchedVetClinic, and SchedPet.",
      });
    }

    try {
      const userRef = db.collection("Compawnions").doc(id);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        return res.status(404).json({ message: "Companion not found." });
      }

      const medSchedArray = userDoc.data().CompawnionUser.MedSched || [];
      await userRef.update({
        "CompawnionUser.MedSched": medSchedArray.concat(MedSched),
      });
      res.json({ message: "MedSched added successfully." });
    } catch (error) {
      console.error("Error adding MedSched:", error);
      res
        .status(500)
        .json({ message: "Failed to add MedSched.", error: error.message });
    }
  });

  Compawnions.post("/addTrustedVet/:id", async (req, res) => {
    const { id } = req.params;
    const { TrustedVet } = req.body;

    if (!TrustedVet) {
      return res.status(400).json({
        message: "All TrustedVet fields are required.",
      });
    }

    const { TVVetClinic, TVAddress } = TrustedVet;
    if (!TVVetClinic || !TVAddress) {
      return res.status(400).json({
        message: "TrustedVet must include TVVetClinic and TVAddress.",
      });
    }

    try {
      const userRef = db.collection("Compawnions").doc(id);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        return res.status(404).json({ message: "Companion not found." });
      }

      const trustedVetArray = userDoc.data().CompawnionUser.TrustedVet || [];
      await userRef.update({
        "CompawnionUser.TrustedVet": trustedVetArray.concat(TrustedVet),
      });
      res.json({ message: "TrustedVet added successfully." });
    } catch (error) {
      console.error("Error adding TrustedVet:", error);
      res
        .status(500)
        .json({ message: "Failed to add TrustedVet.", error: error.message });
    }
  });

  Compawnions.post("/addCompawnionSched/:id", async (req, res) => {
    const { id } = req.params;
    const { CompawnionSched } = req.body;

    if (!CompawnionSched) {
      return res.status(400).json({
        message: "All CompawnionSched fields are required.",
      });
    }

    const { EventTitle, CSDate, CSTime, GmeetRoom } = CompawnionSched;
    if (!EventTitle || !CSDate || !CSTime || !GmeetRoom) {
      return res.status(400).json({
        message:
          "CompawnionSched must include EventTitle, CSDate, CSTime, and GmeetRoom.",
      });
    }

    try {
      const userRef = db.collection("Compawnions").doc(id);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        return res.status(404).json({ message: "Companion not found." });
      }

      const compawnionSchedArray =
        userDoc.data().CompawnionUser.CompawnionSched || [];
      await userRef.update({
        "CompawnionUser.CompawnionSched":
          compawnionSchedArray.concat(CompawnionSched),
      });
      res.json({ message: "CompawnionSched added successfully." });
    } catch (error) {
      console.error("Error adding CompawnionSched:", error);
      res.status(500).json({
        message: "Failed to add CompawnionSched.",
        error: error.message,
      });
    }
  });

  // Get response for companion details
  Compawnions.get("/schedules/:companionId", async (req, res) => {
    const { companionId } = req.params; // Extract companionId from route parameters

    if (!companionId) {
      return res.status(400).json({ message: "Companion ID is required." });
    }

    try {
      // Locate the companion document by ID
      const userDoc = await db.collection("Compawnions").doc(companionId).get();

      if (!userDoc.exists) {
        return res.status(404).json({ message: "Companion not found." });
      }

      // Extract the user's details
      const userData = userDoc.data().CompawnionUser;

      const companionDetails = {
        MedSched: userData.MedSched || [],
        TrustedVet: userData.TrustedVet || [],
        CompawnionSched: userData.CompawnionSched || [],
      };

      res.json({
        message: "Companion details retrieved successfully.",
        data: companionDetails,
      });
    } catch (error) {
      console.error("Error retrieving companion details:", error); // Log the error
      res.status(500).json({
        message: "Failed to retrieve companion details.",
        error: error.message,
      }); // Include error message in response
    }
  });

  // Route to get MedSched details
  Compawnions.get("/MedSched/:companionId", async (req, res) => {
    const { companionId } = req.params;

    if (!companionId) {
      return res.status(400).json({ message: "Companion ID is required." });
    }

    try {
      const userDoc = await db.collection("Compawnions").doc(companionId).get();

      if (!userDoc.exists) {
        return res.status(404).json({ message: "Companion not found." });
      }

      const medSched = userDoc.data().CompawnionUser?.MedSched || [];
      res.json({
        message: "MedSched details retrieved successfully.",
        data: medSched,
      });
    } catch (error) {
      console.error("Error retrieving MedSched details:", error);
      res.status(500).json({
        message: "Failed to retrieve MedSched details.",
        error: error.message,
      });
    }
  });

  // Route to get TrustedVet details
  Compawnions.get("/TrustedVet/:companionId", async (req, res) => {
    const { companionId } = req.params;

    if (!companionId) {
      return res.status(400).json({ message: "Companion ID is required." });
    }

    try {
      const userDoc = await db.collection("Compawnions").doc(companionId).get();

      if (!userDoc.exists) {
        return res.status(404).json({ message: "Companion not found." });
      }

      const trustedVet = userDoc.data().CompawnionUser?.TrustedVet || [];
      res.json({
        message: "TrustedVet details retrieved successfully.",
        data: trustedVet,
      });
    } catch (error) {
      console.error("Error retrieving TrustedVet details:", error);
      res.status(500).json({
        message: "Failed to retrieve TrustedVet details.",
        error: error.message,
      });
    }
  });

  // Route to get CompawnionSched details
  Compawnions.get("/CompawnionSched/:companionId", async (req, res) => {
    const { companionId } = req.params;

    if (!companionId) {
      return res.status(400).json({ message: "Companion ID is required." });
    }

    try {
      const userDoc = await db.collection("Compawnions").doc(companionId).get();

      if (!userDoc.exists) {
        return res.status(404).json({ message: "Companion not found." });
      }

      const compawnionSched =
        userDoc.data().CompawnionUser?.CompawnionSched || [];
      res.json({
        message: "CompawnionSched details retrieved successfully.",
        data: compawnionSched,
      });
    } catch (error) {
      console.error("Error retrieving CompawnionSched details:", error);
      res.status(500).json({
        message: "Failed to retrieve CompawnionSched details.",
        error: error.message,
      });
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
